# Build stage: compiles the app
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore "RememberMe.csproj"
RUN dotnet publish "RememberMe.csproj" -c Release -o /app/publish

# Runtime stage: just runs the already-built app (smaller, faster to start)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render (and most Docker hosts) tell the container which port to listen on
# via the PORT environment variable at startup. Default to 8080 if it's not set.
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "-c", "ASPNETCORE_URLS=http://+:${PORT} dotnet RememberMe.dll"]
