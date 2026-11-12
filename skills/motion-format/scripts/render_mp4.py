#!/usr/bin/env python3
"""Jembatan untuk panduan lama & Paket Template Motion: sama dengan `mf.py render`.
  python3 render_mp4.py <proyek> [--sampai 8] [--fps 30] [--out nama.mp4] [--tanpa-audio]"""
import os, sys
sys.argv = [sys.argv[0], 'render'] + (sys.argv[1:] or ['.'])
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mf
mf.main()
