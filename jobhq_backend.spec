# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules

import os
import sys

block_cipher = None

# Determine platform target triple dynamically
is_win = sys.platform.startswith('win')
is_darwin = sys.platform == 'darwin'

if is_win:
    exe_name = 'jobhq-backend-x86_64-pc-windows-msvc'
elif is_darwin:
    import platform
    arch = 'aarch64' if platform.machine() == 'arm64' else 'x86_64'
    exe_name = f'jobhq-backend-{arch}-apple-darwin'
else:
    exe_name = 'jobhq-backend-x86_64-unknown-linux-gnu'

datas = []
datas += collect_data_files('llama_cpp')

binaries = []
binaries += collect_dynamic_libs('llama_cpp')

hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespans',
    'uvicorn.lifespans.on',
    'sqlalchemy.dialects.sqlite',
    'pydantic_settings',
    'cryptography',
    'llama_cpp',
]
hiddenimports += collect_submodules('llama_cpp')

a = Analysis(
    ['backend/desktop.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='jobhq-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='dist_backend/jobhq-backend',
)
