import os
import json
from pathlib import Path

def handler(event, context):
    # Writing to a file on the EFS filesystem
    path = Path("/mnt/filesystem/test.txt")
    with path.open("w") as f:
        f.write("Test123")
    # Now open the file, read the text, return
    with path.open("r") as f:
        text = f.read()

    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Hello Lambda! {text}"})
    }
