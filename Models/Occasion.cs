namespace RememberMe.Models;

public class Occasion
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public AppUser? User { get; set; }

    public string Name { get; set; } = string.Empty;

    // Month is stored 0-11 (0 = January) to line up with the calendar UI.
    public int Month { get; set; }
    public int Day { get; set; }
    public int? Year { get; set; }

    public string? Notes { get; set; }

    // How many years into the future this occasion should keep reminding for.
    public int TrackYears { get; set; } = 100;

    public bool PresentPlanned { get; set; }
    public decimal Amount { get; set; }

    // "daily" | "monthly" | "yearly"
    public string Frequency { get; set; } = "monthly";
    public decimal SavedSoFar { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Set the first time someone clicks "Share" on this occasion - lets anyone with
    // the link view it and add it to their own account.
    public string? ShareToken { get; set; }

    // If this occasion was added by someone via a share link, this records which
    // link it came from, so we don't add the same shared occasion twice.
    public string? ClaimedFromToken { get; set; }
}
