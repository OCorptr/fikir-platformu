using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Infrastructure.Time;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddProblemDetails();

const string DevelopmentFrontendPolicy = "DevelopmentFrontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevelopmentFrontendPolicy, policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseCors(DevelopmentFrontendPolicy);
}

app.MapGet("/api/health", (IClock clock) => Results.Ok(new
{
    status = "healthy",
    application = "Geleceğin Fikri API",
    utcTime = clock.UtcNow
}));

app.Run();

public partial class Program;
