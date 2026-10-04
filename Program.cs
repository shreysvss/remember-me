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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=occasions.db"));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
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

builder.Services.AddAuthorization();
builder.Services.AddHostedService<OccasionNotificationService>();

var app = builder.Build();

// Creates occasions.db automatically on first run - no manual migration step needed.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
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
