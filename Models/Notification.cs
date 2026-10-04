namespace RememberMe.Models;

public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? OccasionId { get; set; }

    public string Message { get; set; } = string.Empty;

    // "1-day" | "3-day" | "7-day"
    public string Type { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
}
