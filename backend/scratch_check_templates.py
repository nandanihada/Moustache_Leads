from database import db_instance
import json
from bson import ObjectId

import datetime

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)

def check_templates():
    col = db_instance.get_collection('support_templates')
    templates = list(col.find())
    print(json.dumps(templates, cls=JSONEncoder, indent=2))

if __name__ == "__main__":
    check_templates()
