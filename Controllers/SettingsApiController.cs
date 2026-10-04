using System.Security.Claims;
using RememberMe.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RememberMe.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsApiController : ControllerBase
{
    private readonly AppDbContext _db;
    public SettingsApiController(AppDbContext db) { _db = db; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static readonly HashSet<string> ValidColors = new() { "pink", "blue", "purple", "green", "yellow", "orange", "red" };
    private static readonly HashSet<string> ValidModes = new() { "light", "dark" };

    public class NotificationSettingsDto
    {
        public bool Notify3DaysBefore { get; set; }
        public bool Notify7DaysBefore { get; set; }
    }

    public class AppearanceSettingsDto
    {
        public string ThemeColor { get; set; } = "pink";
        public string ThemeMode { get; set; } = "light";
    }

    [HttpGet]
    public IActionResult Get()
    {
        var u = _db.Users.First(x => x.Id == CurrentUserId);
        return Ok(new
        {
            notify3DaysBefore = u.Notify3DaysBefore,
            notify7DaysBefore = u.Notify7DaysBefore,
            themeColor = u.ThemeColor,
            themeMode = u.ThemeMode,
            username = u.Username
        });
    }

    [HttpPut("notifications")]
    public IActionResult UpdateNotifications([FromBody] NotificationSettingsDto dto)
    {
        var u = _db.Users.First(x => x.Id == CurrentUserId);
        u.Notify3DaysBefore = dto.Notify3DaysBefore;
        u.Notify7DaysBefore = dto.Notify7DaysBefore;
        _db.SaveChanges();
        return Ok();
    }

    [HttpPut("appearance")]
    public IActionResult UpdateAppearance([FromBody] AppearanceSettingsDto dto)
    {
        var color = ValidColors.Contains(dto.ThemeColor) ? dto.ThemeColor : "pink";
        var mode = ValidModes.Contains(dto.ThemeMode) ? dto.ThemeMode : "light";

        var u = _db.Users.First(x => x.Id == CurrentUserId);
        u.ThemeColor = color;
        u.ThemeMode = mode;
        _db.SaveChanges();
        return Ok(new { themeColor = color, themeMode = mode });
    }
}
