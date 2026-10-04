using Microsoft.AspNetCore.Mvc.RazorPages;

namespace RememberMe.Pages;

public class ShareModel : PageModel
{
    public string Token { get; set; } = string.Empty;

    public void OnGet(string token)
    {
        Token = token;
    }
}
