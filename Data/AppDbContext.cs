using RememberMe.Models;
using Microsoft.EntityFrameworkCore;

namespace RememberMe.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Occasion> Occasions => Set<Occasion>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.GoogleId)
            .IsUnique();

        modelBuilder.Entity<Occasion>()
            .HasOne(b => b.User)
            .WithMany(u => u.Occasions)
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Occasion>()
            .Property(b => b.Amount)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<Occasion>()
            .Property(b => b.SavedSoFar)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<Notification>()
            .HasIndex(n => new { n.UserId, n.CreatedAt });

        modelBuilder.Entity<Occasion>()
            .HasIndex(b => b.ShareToken)
            .IsUnique();
    }
}