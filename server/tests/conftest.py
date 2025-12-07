import pytest
from unittest.mock import MagicMock
import sys
import os

# Ensure src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))

from src.utils.adapter_factory import AdapterFactory
from src.events.event_bus import EventBus

class FakeCollection:
    def __init__(self, data=None):
        self.data = data or {}  # dict of _id -> doc

    def find_one(self, query):
        # This is a simplified find_one. It doesn't handle complex queries.
        for doc in self.data.values():
            if self._doc_matches_query(doc, query):
                return doc
        return None

    def find(self, query=None):
        query = query or {}
        return [doc for doc in self.data.values() if self._doc_matches_query(doc, query)]

    def _doc_matches_query(self, doc, query):
        for key, value in query.items():
            if key == '$or':
                if not any(self._doc_matches_query(doc, sub_query) for sub_query in value):
                    return False
            elif key == '$in':
                # This case is not hit by the app's current queries, which use {"field": {"$in": ...}}
                return False
            elif isinstance(value, dict):
                is_match = True
                for op, op_val in value.items():
                    if op == '$in':
                        doc_val = doc.get(key)
                        # Handle ObjectId and string comparison
                        if doc_val not in op_val and str(doc_val) not in [str(v) for v in op_val]:
                            is_match = False
                    elif op == '$regex':
                        import re
                        doc_val = doc.get(key, "")
                        flags = re.IGNORECASE if value.get("$options") == "i" else 0
                        if not re.search(op_val, doc_val, flags):
                            is_match = False
                if not is_match:
                    return False
            else:
                doc_val = doc.get(key)
                if doc_val != value and str(doc_val) != str(value):
                    # Also check for list membership for queries like `{"member_ids": "user1"}`
                    if isinstance(doc_val, list) and value not in doc_val:
                         return False
                    elif not isinstance(doc_val, list):
                         return False
        return True

    def insert_one(self, doc):
        # Simulate _id generation if missing
        if "_id" not in doc:
            from bson import ObjectId
            doc["_id"] = ObjectId()
        
        new_doc = doc.copy()
        if isinstance(new_doc.get("_id"), str):
             # For tests that save with string IDs
             self.data[new_doc["_id"]] = new_doc
        else:
             self.data[str(new_doc["_id"])] = new_doc

        return MagicMock(inserted_id=new_doc["_id"])

    def update_one(self, query, update):
        doc = self.find_one(query)
        if doc:
            if "$set" in update:
                doc.update(update["$set"])
            if "$addToSet" in update:
                for k, v in update["$addToSet"].items():
                    if k not in doc:
                        doc[k] = []
                    # Handle $each
                    items_to_add = v["$each"] if isinstance(v, dict) and "$each" in v else [v]
                    for item in items_to_add:
                        if item not in doc[k]:
                            doc[k].append(item)
            if "$inc" in update:
                for k, v in update["$inc"].items():
                    doc[k] = doc.get(k, 0) + v
            return MagicMock(modified_count=1, matched_count=1)
        return MagicMock(modified_count=0, matched_count=0)
    
    def find_one_and_update(self, query, update, **kwargs):
        doc = self.find_one(query)
        if doc:
            original_doc = doc.copy()
            self.update_one(query, update)
            return doc if kwargs.get("return_document") else original_doc
        return None

    def delete_one(self, query):
        doc = self.find_one(query)
        if doc:
            del self.data[str(doc["_id"])]
            return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)
    
    def delete_many(self, query):
        docs_to_delete = self.find(query)
        count = len(docs_to_delete)
        for doc in docs_to_delete:
            if str(doc["_id"]) in self.data:
                 del self.data[str(doc["_id"])]
        return MagicMock(deleted_count=count)
        
    def aggregate(self, pipeline):
        # Simplified mock for user_stats_service
        match_query = pipeline[0].get('$match', {})
        
        matched_docs = self.find(match_query)
        
        if not matched_docs:
            return []
            
        # Simplified sum
        total_dist = sum(doc.get('stats', {}).get('distance_km', 0) or 0 for doc in matched_docs)
        total_elev = sum(doc.get('stats', {}).get('elevation_gain_m', 0) or 0 for doc in matched_docs)
        
        return [{
            "_id": None,
            "total_distance_km": total_dist,
            "total_elevation_gain_m": total_elev,
            "total_trips": len(matched_docs)
        }]

class FakeMongoDBAdapter:
    def __init__(self):
        self.collections = {}

    def get_collection(self, name):
        if name not in self.collections:
            self.collections[name] = FakeCollection()
        return self.collections[name]

    def save_data(self, key, data, collection_name=None):
        if not collection_name:
            raise ValueError("collection_name required")
        col = self.get_collection(collection_name)
        # Upsert logic
        if "_id" not in data:
            data["_id"] = key
        col.data[str(key)] = data

    def load_data(self, key, collection_name=None):
        if not collection_name:
            raise ValueError("collection_name required")
        col = self.get_collection(collection_name)
        return col.data.get(str(key))

    def delete_data(self, key, collection_name=None):
        if not collection_name:
            raise ValueError("collection_name required")
        col = self.get_collection(collection_name)
        if str(key) in col.data:
            del col.data[str(key)]
            return True
        return False
    
    def exists(self, key, collection_name=None):
        if not collection_name:
            raise ValueError("collection_name required")
        col = self.get_collection(collection_name)
        return str(key) in col.data

class FakeMinIOAdapter:
    def __init__(self):
        self.buckets = {}

    def save_data(self, object_name, data, bucket=None):
        if not bucket:
            raise ValueError("bucket required")
        if bucket not in self.buckets:
            self.buckets[bucket] = {}
        self.buckets[bucket][object_name] = data

    def load_data(self, object_name, bucket=None):
        if not bucket:
            raise ValueError("bucket required")
        return self.buckets.get(bucket, {}).get(object_name)

    def delete_data(self, object_name, bucket=None):
        if not bucket:
            raise ValueError("bucket required")
        if bucket in self.buckets and object_name in self.buckets[bucket]:
            del self.buckets[bucket][object_name]
            return True
        return False
    
    def exists(self, object_name, bucket=None):
        if not bucket:
            raise ValueError("bucket required")
        return bucket in self.buckets and object_name in self.buckets[bucket]
    
    def list_keys(self, bucket=None, prefix=""):
        if not bucket:
            raise ValueError("bucket required")
        if bucket not in self.buckets:
            return []
        return [k for k in self.buckets[bucket].keys() if k.startswith(prefix)]

@pytest.fixture
def mock_mongodb_adapter(monkeypatch):
    adapter = FakeMongoDBAdapter()
    monkeypatch.setattr(AdapterFactory, 'create_mongodb_adapter', lambda: adapter)
    return adapter

@pytest.fixture
def mock_minio_adapter(monkeypatch):
    adapter = FakeMinIOAdapter()
    monkeypatch.setattr(AdapterFactory, 'create_minio_adapter', lambda: adapter)
    return adapter

@pytest.fixture
def mock_event_bus(monkeypatch):
    # Mock publish to just record events
    events = []
    def fake_publish(topic, payload):
        events.append((topic, payload))
    
    monkeypatch.setattr(EventBus, 'publish', staticmethod(fake_publish))
    return events

@pytest.fixture
def mock_storage_manager(monkeypatch, mock_mongodb_adapter, mock_minio_adapter):
    # Ensure StorageManager uses our fake adapters
    # Since StorageManager instantiates adapters in __init__ or via add_adapter,
    # and we patched AdapterFactory, it should work.
    # But we can also patch StorageManager to be safe if needed.
    pass
