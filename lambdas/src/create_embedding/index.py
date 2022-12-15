import os
import sys
import json
import zipfile
import boto3

s3_client = boto3.client("s3")

path = '/mnt/filesystem'

def save_zip(zip_key, directory, from_bucket):
    output_path = f'{path}/{directory}'
    zip_path = f'{path}/{zip_key}'

    try:
        os.mkdir(output_path)
    except FileExistsError:
        pass

    s3_client.download_file(from_bucket, zip_key, zip_path)

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(output_path)


def install_sentence_transformers():
    bucket = 'similarity-embeddings'
    save_zip("sentence_transformers_lib.zip", "python", bucket)
    save_zip("msmarco-distilbert-cos-v5-model.zip", "model", bucket)

# Todo: Create standalone lambdas to install package and model, also for removing/updating
# Note: uncomment to install
# install_sentence_transformers()

sys.path.append(f"{path}/python/sentence_transformers_lib")
from sentence_transformers import SentenceTransformer, util

def handler(event, context):
    query = "A significant proportion of alcoholics manage to live with the disease daily"
    docs = [
        "Some 85% of alcoholics don't mind drinking and live quite happily day to day",
        "Alcoholism is a devastating affliction, that often causes harm to the drinkers loved ones",
        "I like ponies and riding bareback especially",
        "one in ten people drink more than they should, one to two litres is enough for most people"
    ]

    query_emb = model.encode(query)
    doc_emb = model.encode(docs)
    scores = util.dot_score(query_emb, doc_emb)[0].cpu().tolist()
    doc_score_pairs = list(zip(docs, scores))
    doc_score_pairs = sorted(doc_score_pairs, key=lambda x: x[1], reverse=True)

    return {
        "statusCode": 200,
        "body": json.dumps({"doc_score_pairs": doc_score_pairs})
#         "body": "DONE"
    }
