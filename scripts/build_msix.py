import os
import subprocess
from PIL import Image

BASE_DIR = r"f:\VedWriter"
LAYOUT_DIR = os.path.join(BASE_DIR, "public", "msix_layout")
ASSETS_DIR = os.path.join(LAYOUT_DIR, "Assets")
MAKEAPPX = r"C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe"

os.makedirs(ASSETS_DIR, exist_ok=True)

# 1. Copy vedwriter.exe
exe_src = os.path.join(BASE_DIR, "src-tauri", "target", "release", "vedwriter.exe")
exe_dst = os.path.join(LAYOUT_DIR, "vedwriter.exe")

with open(exe_src, "rb") as f_in, open(exe_dst, "wb") as f_out:
    f_out.write(f_in.read())

print("Copied vedwriter.exe")

# 2. Resize icons
icon_src = os.path.join(BASE_DIR, "src-tauri", "icons", "icon.png")
icon_img = Image.open(icon_src).convert("RGBA")

sizes = {
    "Square44x44Logo.png": (44, 44),
    "Square150x150Logo.png": (150, 150),
    "StoreLogo.png": (50, 50)
}

for filename, size in sizes.items():
    resized = icon_img.resize(size, Image.Resampling.LANCZOS)
    resized.save(os.path.join(ASSETS_DIR, filename))
    print(f"Generated asset: {filename} ({size})")

# 3. Create AppxManifest.xml
manifest_content = """<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">

  <Identity
    Name="com.vedwriter.app"
    Publisher="CN=AhmedAchtatar"
    Version="1.0.0.0"
    ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>VedWriter</DisplayName>
    <PublisherDisplayName>Ahmed Achtatar</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>

  <Resources>
    <Resource Language="en-us"/>
  </Resources>

  <Applications>
    <Application Id="VedWriter"
                 Executable="vedwriter.exe"
                 EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="VedWriter"
        Description="Zero-knowledge encrypted journal for learning, studying, and thinking"
        BackgroundColor="#0F172A"
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png">
      </uap:VisualElements>
    </Application>
  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"""

manifest_path = os.path.join(LAYOUT_DIR, "AppxManifest.xml")
with open(manifest_path, "w", encoding="utf-8") as f:
    f.write(manifest_content.strip())

print("Created AppxManifest.xml")

# 4. Run makeappx pack
msix_output = os.path.join(BASE_DIR, "public", "VedWriter_1.0.0_x64.msix")
if os.path.exists(msix_output):
    os.remove(msix_output)

cmd = [MAKEAPPX, "pack", "/d", LAYOUT_DIR, "/p", msix_output, "/o"]
print("Running command:", " ".join(cmd))
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
print("Return code:", res.returncode)

if res.returncode == 0:
    print("SUCCESS! Built MSIX package at:", msix_output)
