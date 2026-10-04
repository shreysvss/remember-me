namespace RememberMe.Models;

public class AppUser
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;

    // Set when someone signs up or logs in with Google. This is Google's own id for
    // that person, which never changes even if they change their name or email.
    // People who signed up with Google have an empty PasswordHash until they set one.
    public string? GoogleId { get; set; }

    // Brute-force protection: after too many wrong passwords in a row, the
    // account is temporarily locked regardless of whether the next guess is right.
    public int FailedLoginAttempts { get; set; } = 0;
    public DateTime? LockoutUntil { get; set; }

    // A reminder the day before always goes out. These two are opt-in extras.
    public bool Notify3DaysBefore { get; set; } = false;
    public bool Notify7DaysBefore { get; set; } = false;

    // Appearance preferences: ThemeColor is one of pink, blue, purple, green, yellow, orange, red.
    // ThemeMode is "light" or "dark".
    public string ThemeColor { get; set; } = "pink";
    public string ThemeMode { get; set; } = "light";

    public List<Occasion> Occasions { get; set; } = new();
}