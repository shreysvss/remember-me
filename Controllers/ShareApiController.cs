using System.Security.Claims;
using RememberMe.Data;
using RememberMe.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RememberMe.Controllers;

[ApiController]
[Route("api/share")]
public class ShareApiController : ControllerBase
{
    private readonly AppDbContext _db;
    public ShareApiController(AppDbContext db) { _db = db; }

    // Anyone with the link can view the basic details - no login required.
    [HttpGet("{token}")]
    public IActionResult Get(string token)
    {
        var b = _db.Occasions.FirstOrDefault(x => x.ShareToken == token);
        if (b == null) return NotFound();

        var owner = _db.Users.FirstOrDefault(u => u.Id == b.UserId);

        return Ok(new
        {
            name = b.Name,
            month = b.Month,
            day = b.Day,
            notes = b.Notes,
            presentPlanned = b.PresentPlanned,
            amount = b.Amount,
            savedSoFar = b.SavedSoFar,
            frequency = b.Frequency,
            sharedBy = owner?.Username
        });
    }

    // Adding it to your own list requires being logged in.
    [HttpPost("{token}/claim")]
    [Authorize]
    public IActionResult Claim(string token)
    {
        var source = _db.Occasions.FirstOrDefault(x => x.ShareToken == token);
        if (source == null) return NotFound();

        var myId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var alreadyAdded = _db.Occasions.Any(x => x.UserId == myId && x.ClaimedFromToken == token);
        if (alreadyAdded) return Ok(new { alreadyAdded = true });

        var copy = new Occasion
        {
            UserId = myId,
            Name = source.Name,
            Month = source.Month,
            Day = source.Day,
            Year = source.Year,
            Notes = source.Notes,
            TrackYears = source.TrackYears,
            PresentPlanned = source.PresentPlanned,
            Amount = source.Amount,
            Frequency = source.Frequency,
            SavedSoFar = 0,
            CreatedAt = DateTime.UtcNow,
            ClaimedFromToken = token
        };

        _db.Occasions.Add(copy);
        _db.SaveChanges();
        return Ok(new { added = true });
    }
}
