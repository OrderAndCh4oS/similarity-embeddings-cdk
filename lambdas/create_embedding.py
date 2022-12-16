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
    }
