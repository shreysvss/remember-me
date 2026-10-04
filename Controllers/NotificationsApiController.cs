using System.Security.Claims;
using RememberMe.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RememberMe.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsApiController : ControllerBase
{
    private readonly AppDbContext _db;
    public NotificationsApiController(AppDbContext db) { _db = db; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public IActionResult GetAll()
    {
        var items = _db.Notifications
            .Where(n => n.UserId == CurrentUserId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(30)
            .Select(n => new { n.Id, n.Message, n.Type, n.CreatedAt, n.IsRead })
            .ToList();

        var unreadCount = _db.Notifications.Count(n => n.UserId == CurrentUserId && !n.IsRead);

        return Ok(new { items, unreadCount });
    }

    [HttpPost("{id}/read")]
    public IActionResult MarkRead(int id)
    {
        var n = _db.Notifications.FirstOrDefault(x => x.Id == id && x.UserId == CurrentUserId);
        if (n == null) return NotFound();
        n.IsRead = true;
        _db.SaveChanges();
        return Ok();
    }

    [HttpPost("read-all")]
    public IActionResult MarkAllRead()
    {
        var mine = _db.Notifications.Where(n => n.UserId == CurrentUserId && !n.IsRead);
        foreach (var n in mine) n.IsRead = true;
        _db.SaveChanges();
        return Ok();
    }
}
