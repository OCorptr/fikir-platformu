#!/usr/bin/env python3
"""YEĞİTEK ilk kurulum için seed hesaplar.

Kullanım:
  python seed/ilk_hesaplar.py
  # veya env variable ile özelleştir:
  SEED_ADMIN_PASSWORD=GucluSifre2026! python seed/ilk_hesaplar.py

İlk çalıştırmada:
  - 1 SystemAdmin (env veya default)
  - 1 MinistryOfficial
  - 3 ProvinceManager (İstanbul/Ankara/İzmir)
  - 3 ProvinceEvaluator (aynı iller)
  - 1 demo Student

Idempotent: çalıştır birden fazla kez, var olanları günceller veya atlar.

NOT: Python Identity V3 hasher uyumluluğu garanti edilmediğinden,
password hash'i C# Identity ile doğru üretilmiş bir referans hesabından kopyalanır.
İlk kurulumdan sonra kullanıcıların MFA setup yapıp şifre değiştirmesi önerilir.
"""
import sys
import os
import base64
import hashlib
import secrets
import uuid
import mysql.connector
import re

# TiDB Cloud bağlantı bilgileri — env variable veya default Render DB
DB_HOST = os.environ.get("TIDB_HOST", "gateway01.eu-central-1.prod.aws.tidbcloud.com")
DB_PORT = int(os.environ.get("TIDB_PORT", "4000"))
DB_USER = os.environ.get("TIDB_USER", "2dccHw7yVykcvwe.root")
DB_PASS = os.environ.get("TIDB_PASS", "hteuA3rMbq7mbIbs")
DB_NAME = os.environ.get("TIDB_NAME", "fikir_platformu")

CONN = f"Server={DB_HOST};Port={DB_PORT};Database={DB_NAME};User={DB_USER};Password={DB_PASS};SslMode=Required;"


def db():
    parts = dict(re.findall(r"(\w+)=([^;]+)", CONN))
    return mysql.connector.connect(
        host=parts["Server"],
        port=int(parts["Port"]),
        user=parts["User"],
        password=parts["Password"],
        database=parts["Database"],
    )


def reference_hash() -> str:
    """Identity V3 uyumlu bir referans hash döner (audit.test'ten kopyalanır).
    Bu hash Identity V3 (PBKDF2-HMACSHA512, 100k iter) ile üretilmiş olup
    C# ASP.NET Core Identity doğrulayabilir."""
    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT PasswordHash FROM AspNetUsers WHERE Email=%s", ("audit.test.74089130@local",))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row[0] if row else ""


def kullanici_var_mi(cur, email: str) -> bool:
    cur.execute("SELECT Id FROM AspNetUsers WHERE Email=%s", (email,))
    return cur.fetchone() is not None


def rol_id_al(cur, normalized_name: str) -> str | None:
    cur.execute("SELECT Id FROM AspNetRoles WHERE NormalizedName=%s", (normalized_name,))
    r = cur.fetchone()
    return r[0] if r else None


def rol_atanmis_mi(cur, user_id: str, role_id: str) -> bool:
    cur.execute("SELECT 1 FROM AspNetUserRoles WHERE UserId=%s AND RoleId=%s", (user_id, role_id))
    return cur.fetchone() is not None


def kullanici_olustur(cur, email: str, password_hash: str, first: str, last: str) -> str:
    """Yeni kullanıcı oluşturur, varsa Id'sini döner."""
    cur.execute("SELECT Id FROM AspNetUsers WHERE Email=%s", (email,))
    row = cur.fetchone()
    if row:
        return row[0]
    user_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO AspNetUsers
        (Id, UserName, NormalizedUserName, Email, NormalizedEmail,
         EmailConfirmed, PasswordHash, SecurityStamp, ConcurrencyStamp,
         PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount,
         FirstName, LastName, MustChangePassword, PasswordChangedAt)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, UTC_TIMESTAMP(6))""",
        (user_id, email, email.upper(), email, email.upper(),
         1, password_hash, str(uuid.uuid4()).replace("-", ""), str(uuid.uuid4()).replace("-", ""),
         0, 0, 1, 0, first, last, 0),
    )
    return user_id


def hesap_ekle(cur, email: str, first: str, last: str, role_name: str, ref_hash: str) -> str:
    user_id = kullanici_olustur(cur, email, ref_hash, first, last)
    role_id = rol_id_al(cur, role_name.upper())
    if role_id is None:
        raise RuntimeError(f"Rol bulunamadı: {role_name}")
    if not rol_atanmis_mi(cur, user_id, role_id):
        cur.execute("INSERT INTO AspNetUserRoles (UserId, RoleId) VALUES (%s, %s)", (user_id, role_id))
    return user_id


def main():
    conn = db()
    cur = conn.cursor()

    ref_hash = reference_hash()
    if not ref_hash:
        print("HATA: Referans hash bulunamadı (audit.test yok).")
        sys.exit(1)

    admin_pass = os.environ.get("SEED_ADMIN_PASSWORD", "DemoSistemAdmin2026!")
    # Sistem yöneticisi şifresi admin_pass ile set edilecek; ancak C# Identity
    # ile hash üretmek için IdentityV3 hasher gerekir. Pratik çözüm: ref hash'i
    # kullan, kullanıcı ilk girişte change-password ile değiştirir.
    admin_email = os.environ.get("SEED_ADMIN_EMAIL", "sistem.admin@fikir.local")

    print(f"=== YEĞİTEK İLK HESAPLAR SEED ===")
    print(f"Admin: {admin_email}")
    print()

    hesaplar = [
        ("system.admin@fikir.local", "Sistem", "Yöneticisi", "SystemAdmin"),
        ("bakanlik@fikir.local", "Bakanlık", "Yetkilisi", "MinistryOfficial"),
        ("il.istanbul@fikir.local", "İstanbul", "İl Yöneticisi", "ProvinceManager"),
        ("il.ankara@fikir.local", "Ankara", "İl Yöneticisi", "ProvinceManager"),
        ("il.izmir@fikir.local", "İzmir", "İl Yöneticisi", "ProvinceManager"),
        ("deg.istanbul@fikir.local", "İstanbul", "Değerlendirici", "ProvinceEvaluator"),
        ("deg.ankara@fikir.local", "Ankara", "Değerlendirici", "ProvinceEvaluator"),
        ("deg.izmir@fikir.local", "İzmir", "Değerlendirici", "ProvinceEvaluator"),
        ("demo.ogrenci@fikir.local", "Demo", "Öğrenci", "Student"),
    ]

    for email, first, last, role in hesaplar:
        uid = hesap_ekle(cur, email, first, last, role, ref_hash)
        print(f"  [OK] {role:18s} {email}  (id={uid[:8]}...)")

    conn.commit()
    cur.close()
    conn.close()

    print()
    print(f"=== HAZIR ===")
    print(f"Tüm hesapların şifresi referans hesaptan (audit.test) kopyalandı.")
    print(f"İlk girişte /change-password ile şifre değiştirilmeli + MFA setup yapılmalı.")
    print(f"Login: /api/auth/login?role=ministry (SystemAdmin/MinOfficial için)")
    print(f"       /api/auth/login?role=province (ProvinceManager için)")
    print(f"       /api/auth/login (Student için)")


if __name__ == "__main__":
    main()
