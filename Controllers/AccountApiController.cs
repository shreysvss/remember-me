using System.Security.Claims;
using RememberMe.Data;
using RememberMe.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace RememberMe.Controllers;

[ApiController]
[Route("api/account")]
[Authorize]
public class AccountApiController : ControllerBase
{
    private readonly AppDbContext _db;
    public AccountApiController(AppDbContext db) { _db = db; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public class ChangeUsernameDto
    {
        public string NewUsername { get; set; } = string.Empty;
    }

    public class ChangePasswordDto
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    [HttpPut("username")]
    public async Task<IActionResult> ChangeUsername([FromBody] ChangeUsernameDto dto)
    {
        var newUsername = (dto.NewUsername ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(newUsername))
            return BadRequest(new { message = "Please enter a username." });

        var user = _db.Users.First(x => x.Id == CurrentUserId);
        if (string.Equals(user.Username, newUsername, StringComparison.Ordinal))
            return Ok(new { username = user.Username });

        if (_db.Users.Any(u => u.Username == newUsername))
            return BadRequest(new { message = "That username is already taken." });

        user.Username = newUsername;
        _db.SaveChanges();

        // The cookie holds the old username in its claims, re-issue it so the
        // change takes effect immediately without forcing a fresh login.
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username)
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

        return Ok(new { username = user.Username });
    }

    [HttpPut("password")]
    public IActionResult ChangePassword([FromBody] ChangePasswordDto dto)
    {
        if (string.IsNullOrEmpty(dto.NewPassword) || dto.NewPassword.Length < 8)
            return BadRequest(new { message = "New password must be at least 8 characters." });

        var user = _db.Users.First(x => x.Id == CurrentUserId);
        var hasher = new PasswordHasher<AppUser>();

        // People who signed up with Google don't have a password yet, so they can set
        // one here without needing a current password. Everyone else has to confirm theirs.
        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            var result = hasher.VerifyHashedPassword(user, user.PasswordHash, dto.CurrentPassword ?? string.Empty);
            if (result == PasswordVerificationResult.Failed)
                return BadRequest(new { message = "Your current password is incorrect." });
        }

        user.PasswordHash = hasher.HashPassword(user, dto.NewPassword);
        _db.SaveChanges();
        return Ok();
    }
}