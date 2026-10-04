using System.Security.Claims;
using RememberMe.Data;
using RememberMe.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;

namespace RememberMe.Pages.Account;

// Handles "Continue with Google" for both logging in and signing up.
// First time someone uses Google, an account is made for them automatically.
// Every time after that, they're logged straight into that same account.
[EnableRateLimiting("auth")]
public class ExternalLoginModel : PageModel
{
    private readonly AppDbContext _db;
    public ExternalLoginModel(AppDbContext db) { _db = db; }

    // Nobody should land here directly, so just send them to the login page.
    public IActionResult OnGet() => RedirectToPage("/Account/Login");

    // The "Continue with Google" button posts here, and we hand the person over to Google.
    public IActionResult OnPost(string? returnUrl = null)
    {
        var redirectUrl = Url.Page("/Account/ExternalLogin", pageHandler: "Callback", values: new { returnUrl });
        var props = new AuthenticationProperties { RedirectUri = redirectUrl };
        return Challenge(props, GoogleDefaults.AuthenticationScheme);
    }

    // Google sends the person back here once they've picked their account.
    public async Task<IActionResult> OnGetCallbackAsync(string? returnUrl = null)
    {
        var result = await HttpContext.AuthenticateAsync("External");
        await HttpContext.SignOutAsync("External");

        var googleId = result.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!result.Succeeded || string.IsNullOrEmpty(googleId))
        {
            TempData["Flash"] = "Google sign in didn't work, please try again";
            TempData["FlashType"] = "error";
            return RedirectToPage("/Account/Login");
        }

        var user = _db.Users.FirstOrDefault(u => u.GoogleId == googleId);
        var isNewUser = false;

        if (user == null)
        {
            var email = result.Principal!.FindFirstValue(ClaimTypes.Email);
            var name = result.Principal!.FindFirstValue(ClaimTypes.GivenName)
                       ?? result.Principal!.FindFirstValue(ClaimTypes.Name);

            user = new AppUser
            {
                Username = MakeUniqueUsername(email, name),
                GoogleId = googleId,
                PasswordHash = string.Empty // no password yet, they can set one in Settings
            };
            _db.Users.Add(user);
            _db.SaveChanges();
            isNewUser = true;
        }

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        TempData["Flash"] = isNewUser ? "Account created, welcome!" : "Logged in successfully";
        TempData["FlashType"] = "success";

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return LocalRedirect(returnUrl);

        return RedirectToPage("/Index");
    }

    // Builds a username from the front part of their email (shrey.v@gmail.com becomes shrey.v),
    // and adds a number on the end if that name is already taken (shrey.v2, shrey.v3...).
    private string MakeUniqueUsername(string? email, string? name)
    {
        var start = !string.IsNullOrWhiteSpace(email) ? email.Split('@')[0] : (name ?? "friend");
        var cleaned = new string(start.Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '.').ToArray());
        if (cleaned.Length == 0) cleaned = "friend";
        if (cleaned.Length > 30) cleaned = cleaned[..30];

        var candidate = cleaned;
        var n = 1;
        while (_db.Users.Any(u => u.Username == candidate))
        {
            n++;
            candidate = $"{cleaned}{n}";
        }
        return candidate;
    }
}