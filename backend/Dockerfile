# Multi-stage Dockerfile for FikirPlatformu.Api
# .NET 10 SDK build + ASP.NET runtime.
# MySQL/TiDB bağlantısı ConnectionStrings__MySql env değişkeni ile sağlanır.
#
# Sprint 11.52: NuGet güvenlik denetimi (NuGetAudit) AÇILDI.
#   Önceden -p:NuGetAudit=false ile kapatılmıştı; teslim edilen bir kamu
#   kurulumunda güvenlik denetiminin susturulması kabul edilemez. GHSA
#   uyarıları artık build logunda görünür ve ayrıca ele alınmalıdır.

# ---------- Build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Solution dosyasını kopyala → restore (layer cache'lenir)
COPY Directory.Build.props ./
COPY FikirPlatformu.slnx ./
COPY src/FikirPlatformu.Domain/*.csproj src/FikirPlatformu.Domain/
COPY src/FikirPlatformu.Application/*.csproj src/FikirPlatformu.Application/
COPY src/FikirPlatformu.Infrastructure/*.csproj src/FikirPlatformu.Infrastructure/
COPY src/FikirPlatformu.Api/*.csproj src/FikirPlatformu.Api/
# NuGet güvenlik denetimi açık bırakıldı (teslim edilen kodda susturulmaz).
RUN dotnet restore src/FikirPlatformu.Api/FikirPlatformu.Api.csproj

# Tüm kaynak kodu kopyala → publish
COPY src/ src/
RUN dotnet publish src/FikirPlatformu.Api/FikirPlatformu.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ---------- Runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Non-root user ile çalıştır (güvenlik)
RUN groupadd --gid 1001 appgroup \
 && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

COPY --from=build /app/publish ./
RUN chown -R appuser:appgroup /app
USER appuser

# Render.com ASP.NET Core 9+ HTTP_PORTS/HTTPS_PORTS env var'larını set eder
# (RFC 9476). Bunlar ASPNETCORE_URLS'i override edip warning üretir.
# Render environment'ta tanımlıysa override'ı kapatmak için boş değer ata,
# ASPNETCORE_URLS tek başına kazansın.
ENV HTTP_PORTS=
ENV HTTPS_PORTS=
# ASP.NET Core default port 8080 (Render.com 8080'i otomatik bind eder)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true
EXPOSE 8080

# Sağlık kontrolü için health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/api/health || exit 1

ENTRYPOINT ["dotnet", "FikirPlatformu.Api.dll"]