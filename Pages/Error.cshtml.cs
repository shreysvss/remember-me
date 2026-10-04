using Microsoft.AspNetCore.Mvc.RazorPages;

namespace RememberMe.Pages;

// Deliberately doesn't show the exception message, stack trace, or request id to
// the visitor - production error pages should never leak internal details.
public class ErrorModel : PageModel
{
    public void OnGet() { }
}
