import os
import sys
import json
import zipfile

path = '/mnt/filesystem'

python_pkg_path = os.path.join(path, "python/lib64/python3.9/site-packages")

sys.path.append(python_pkg_path)

from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer(f'{path}/msmarco-distilbert-cos-v5-model')

def handler(event, context):
    body = json.loads(event["body"])

    errors = []
    if not body["text"]:
        errors.append('Missing text parameter')

    if(len(errors)):
        return {
           "statusCode": 400,
           "body": json.dumps(errors)
       }

    embedding = model.encode(body["text"])

    return {
        "statusCode": 200,
        "body": json.dumps({"embedding": embedding.tolist()})
    }
