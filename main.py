"""Entry point — starts the full StockFlow app."""
import subprocess
import sys
import os

if __name__ == "__main__":
    os.execvp("bash", ["bash", "start.sh"])
