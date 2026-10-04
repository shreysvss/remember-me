using System.Security.Claims;
using RememberMe.Data;
using RememberMe.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace RememberMe.Controllers;

[ApiController]
[Route("api/occasions")]
[Authorize]
public class OccasionsApiController : ControllerBase
{
    private readonly AppDbContext _db;
    public OccasionsApiController(AppDbContext db) { _db = db; }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private const int MaxNameLength = 150;
    private const int MaxNotesLength = 2000;

    private string? ValidateLengths(OccasionDto dto)
    {
        if (dto.Name != null && dto.Name.Length > MaxNameLength)
            return $"Name can't be longer than {MaxNameLength} characters.";
        if (dto.Notes != null && dto.Notes.Length > MaxNotesLength)
            return $"Notes can't be longer than {MaxNotesLength} characters.";
        return null;
    }

    public class OccasionDto
    {
        public string Name { get; set; } = string.Empty;
        public int Month { get; set; }
        public int Day { get; set; }
        public int? Year { get; set; }
        public string? Notes { get; set; }
        public int TrackYears { get; set; } = 100;
        public bool PresentPlanned { get; set; }
        public decimal Amount { get; set; }
        public string Frequency { get; set; } = "monthly";
        public decimal SavedSoFar { get; set; }
    }

    [HttpGet]
    public IActionResult GetAll()
    {
        var list = _db.Occasions
            .Where(b => b.UserId == CurrentUserId)
            .OrderBy(b => b.Month).ThenBy(b => b.Day)
            .Select(b => new
            {
                b.Id,
                b.Name,
                b.Month,
                b.Day,
                b.Year,
                b.Notes,
                b.TrackYears,
                b.PresentPlanned,
                b.Amount,
                b.Frequency,
                b.SavedSoFar,
                b.CreatedAt
            })
            .ToList();

        return Ok(list);
    }

    [HttpPost]
    public IActionResult Create([FromBody] OccasionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Name is required.");
        if (dto.Year.HasValue && dto.Year.Value > DateTime.UtcNow.Year)
            return BadRequest("Year can't be in the future.");
        var lengthError = ValidateLengths(dto);
        if (lengthError != null) return BadRequest(lengthError);

        var entity = new Occasion
        {
            UserId = CurrentUserId,
            Name = dto.Name.Trim(),
            Month = Math.Clamp(dto.Month, 0, 11),
            Day = Math.Clamp(dto.Day, 1, 31),
            Year = dto.Year,
            Notes = dto.Notes,
            TrackYears = dto.TrackYears <= 0 ? 100 : dto.TrackYears,
            PresentPlanned = dto.PresentPlanned,
            Amount = dto.PresentPlanned ? dto.Amount : 0,
            Frequency = dto.Frequency,
            SavedSoFar = dto.PresentPlanned ? Math.Min(dto.SavedSoFar, dto.Amount) : 0,
            CreatedAt = DateTime.UtcNow
        };

        _db.Occasions.Add(entity);
        _db.SaveChanges();
        return Ok(new { id = entity.Id });
    }

    [HttpPut("{id}")]
    public IActionResult Update(int id, [FromBody] OccasionDto dto)
    {
        var entity = _db.Occasions.FirstOrDefault(b => b.Id == id && b.UserId == CurrentUserId);
        if (entity == null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
        if (dto.Year.HasValue && dto.Year.Value > DateTime.UtcNow.Year)
            return BadRequest("Year can't be in the future.");
        var lengthError = ValidateLengths(dto);
        if (lengthError != null) return BadRequest(lengthError);

        entity.Name = dto.Name.Trim();
        entity.Month = Math.Clamp(dto.Month, 0, 11);
        entity.Day = Math.Clamp(dto.Day, 1, 31);
        entity.Year = dto.Year;
        entity.Notes = dto.Notes;
        entity.TrackYears = dto.TrackYears <= 0 ? 100 : dto.TrackYears;
        entity.PresentPlanned = dto.PresentPlanned;
        entity.Amount = dto.PresentPlanned ? dto.Amount : 0;
        entity.Frequency = dto.Frequency;
        entity.SavedSoFar = dto.PresentPlanned ? Math.Min(dto.SavedSoFar, dto.Amount) : 0;

        _db.SaveChanges();
        return Ok();
    }

    [HttpDelete("{id}")]
    public IActionResult Delete(int id)
    {
        var entity = _db.Occasions.FirstOrDefault(b => b.Id == id && b.UserId == CurrentUserId);
        if (entity == null) return NotFound();

        _db.Occasions.Remove(entity);
        _db.SaveChanges();
        return Ok();
    }

    [HttpPost("{id}/share")]
    public IActionResult CreateShareLink(int id)
    {
        var entity = _db.Occasions.FirstOrDefault(b => b.Id == id && b.UserId == CurrentUserId);
        if (entity == null) return NotFound();

        if (string.IsNullOrEmpty(entity.ShareToken))
        {
            entity.ShareToken = Guid.NewGuid().ToString("N");
            _db.SaveChanges();
        }

        var url = $"{Request.Scheme}://{Request.Host}/Share/{entity.ShareToken}";
        return Ok(new { token = entity.ShareToken, url });
    }
}
