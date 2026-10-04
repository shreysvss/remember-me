using RememberMe.Data;
using RememberMe.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddControllers();

// Limits repeated hits on login/register to slow down scripted credential-stuffing
// or mass account creation. Keyed by IP so it doesn't block one abusive visitor's
// neighbours on the same network from ever logging in.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    options.RejectionStatusCode = 429;
});

// On your computer this uses the SQLite file like before. When the app is live,
// Render gives it a DATABASE_URL pointing at Neon, and it uses Postgres instead.
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

if (!string.IsNullOrWhiteSpace(databaseUrl))
{
    // Lets Postgres accept dates the same way SQLite did, so nothing else has to change.
    AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(ToNpgsqlConnectionString(databaseUrl)));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=occasions.db"));
}

var authBuilder = builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.AccessDeniedPath = "/Account/Login";
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = true;
        options.Cookie.HttpOnly = true;                          // JavaScript can never read the auth cookie
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;  // cookie is never sent over plain http
        options.Cookie.SameSite = SameSiteMode.Lax;                // blocks cross-site POST/PUT/DELETE forgery
    });

// "Continue with Google" only switches on when the Google keys are set up. On your computer
// they come from dotnet user-secrets, and on Render they come from environment variables.
// If they're missing, the app still runs fine, the Google button just doesn't show.
var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];

if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    authBuilder
        // A short lived cookie that only holds who Google said they are, for the few
        // seconds between coming back from Google and being logged into Remember Me.
        .AddCookie("External", options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
        })
        .AddGoogle(options =>
        {
            options.ClientId = googleClientId;
            options.ClientSecret = googleClientSecret;
            options.SignInScheme = "External";
        });
}

builder.Services.AddAuthorization();
builder.Services.AddHostedService<OccasionNotificationService>();

var app = builder.Build();

// Creates the database tables automatically on first run (SQLite or Postgres), no manual migration step needed.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // EnsureCreated only builds a brand new database, it never adds new columns to one
    // that already exists. This adds the GoogleId column to older databases (like the
    // occasions.db already on your computer) so your existing data keeps working.
    try
    {
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ADD COLUMN \"GoogleId\" TEXT NULL");
    }
    catch
    {
        // The column is already there, nothing to do.
    }
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

// Render (and most PaaS hosts) sit in front of the app as a reverse proxy that terminates
// HTTPS and forwards plain HTTP internally. Without this, the app thinks every request
// arrived over http, which breaks HTTPS redirects and makes share links come out wrong.
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedHeadersOptions.KnownNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseHttpsRedirection();

// A handful of headers that tell the browser to be stricter about how it treats
// this site - blocks it being embedded in someone else's page (clickjacking),
// stops browsers guessing content types in a way that can enable XSS, and limits
// how much of the current URL leaks to other sites via the Referer header.
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    await next();
});

app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapRazorPages();
app.MapControllers();

app.Run();

// Neon gives you a link like postgresql://user:pass@host/dbname?sslmode=require
// but the .NET Postgres driver wants Host=...;Username=... style, so this converts it.
static string ToNpgsqlConnectionString(string url)
{
    if (!url.StartsWith("postgres")) return url;

    var uri = new Uri(url);
    var userInfo = uri.UserInfo.Split(':', 2);

    var csb = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
        Database = uri.AbsolutePath.TrimStart('/'),
        SslMode = Npgsql.SslMode.Require
    };
    return csb.ConnectionString;
}