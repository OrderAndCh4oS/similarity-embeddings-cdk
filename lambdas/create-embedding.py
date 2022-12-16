import os
import sys
import json
import zipfile

model_name = os.environ["MODEL_NAME"]

path = '/mnt/filesystem'

python_pkg_path = os.path.join(path, "python/lib64/python3.9/site-packages")

sys.path.append(python_pkg_path)

from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer(f'{path}/models/{model_name}')

def handler(event, context):
    body = json.loads(event["body"])

    errors = []
    if not body["texts"]:
        errors.append('Missing texts parameter')

    if(len(errors)):
        return {
           "statusCode": 400,
           "body": json.dumps(errors)
       }

    embeddings = []
    for text in body["texts"]:
        embeddings.append(model.encode(text))

    return {
        "statusCode": 200,
        "body": json.dumps({"embeddings": [embedding.tolist() for embedding in embeddings]})
    }
