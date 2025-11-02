import pytest
from unittest.mock import MagicMock, patch
from src.utils.dbbutler.minio_adapter import MinIOAdapter
from src.utils.dbbutler.redis_adapter import RedisAdapter
from src.utils.dbbutler.mongodb_adapter import MongoDBAdapter
from src.utils.dbbutler.storage_manager import StorageManager
from minio.error import S3Error
import redis.exceptions
from pymongo.errors import PyMongoError


@pytest.fixture
def minio_adapter():
    with patch('minio.Minio') as MockMinio:
        mock_client = MockMinio.return_value
        adapter = MinIOAdapter(endpoint='localhost:9000', access_key='access-key', secret_key='secret-key',
                               secure=False)
        yield adapter, mock_client


@pytest.fixture
def redis_adapter():
    with patch('redis.StrictRedis') as MockRedis:
        mock_client = MockRedis.return_value
        adapter = RedisAdapter(host='localhost', port=6379)
        yield adapter, mock_client


@pytest.fixture
def mongodb_adapter():
    with patch('pymongo.MongoClient') as MockMongoClient:
        mock_client = MockMongoClient.return_value
        adapter = MongoDBAdapter(host='localhost', port=27017, db_name='testdb', collection_name='testcollection')
        yield adapter, mock_client


def test_minio_adapter_save_load_delete(minio_adapter):
    adapter, mock_client = minio_adapter
    key = 'test-key'
    data = b'test-data'

    # Mock the put_object method to prevent actual HTTP requests
    mock_client.put_object.return_value = None

    # Test save
    adapter.save_data(key, data, bucket='test-bucket')
    mock_client.put_object.assert_called_once_with('test-bucket', key, MagicMock(), len(data))

    # Mock the get_object method to prevent actual HTTP requests
    mock_response = MagicMock()
    mock_response.read.return_value = data
    mock_client.get_object.return_value = mock_response

    # Test load
    loaded_data = adapter.load_data(key, bucket='test-bucket')
    assert loaded_data == data
    mock_client.get_object.assert_called_once_with('test-bucket', key)

    # Mock the remove_object method to prevent actual HTTP requests
    mock_client.remove_object.return_value = None

    # Test delete
    adapter.delete_data(key, bucket='test-bucket')
    mock_client.remove_object.assert_called_once_with('test-bucket', key)

    # Mock the stat_object method to simulate the object exists
    mock_client.stat_object.return_value = MagicMock()

    # Test exists
    assert adapter.exists(key, bucket='test-bucket') is True
    mock_client.stat_object.assert_called_once_with('test-bucket', key)

    # Mock the list_objects method to simulate listing objects
    mock_client.list_objects.return_value = [MagicMock(object_name='key1'), MagicMock(object_name='key2')]

    # Test list keys
    keys = adapter.list_keys(bucket='test-bucket')
    assert keys == ['key1', 'key2']
    mock_client.list_objects.assert_called_once_with('test-bucket', '', recursive=True)


def test_minio_adapter_exceptions(minio_adapter):
    adapter, mock_client = minio_adapter
    key = 'test-key'
    bucket = 'test-bucket'
    data = b'test-data'

    # Mock the put_object method to raise an exception
    mock_client.put_object.side_effect = S3Error("NoSuchBucket", "Bucket does not exist")
    with pytest.raises(ValueError, match=f"Bucket '{bucket}' does not exist"):
        adapter.save_data(key, data, bucket=bucket)

    # Mock the get_object method to raise an exception
    mock_client.get_object.side_effect = S3Error("NoSuchBucket", "Bucket does not exist")
    with pytest.raises(ValueError, match=f"Bucket '{bucket}' does not exist"):
        adapter.load_data(key, bucket=bucket)

    # Mock the remove_object method to raise an exception
    mock_client.remove_object.side_effect = S3Error("NoSuchBucket", "Bucket does not exist")
    with pytest.raises(ValueError, match=f"Bucket '{bucket}' does not exist"):
        adapter.delete_data(key, bucket=bucket)


def test_redis_adapter_save_load_delete(redis_adapter):
    adapter, mock_client = redis_adapter
    key = 'test-key'
    data = 'test-data'

    # Test save
    adapter.save_data(key, data)
    mock_client.set.assert_called_once_with(key, data)

    # Test load
    mock_client.get.return_value = data.encode('utf-8')
    loaded_data = adapter.load_data(key)
    assert loaded_data == data
    mock_client.get.assert_called_once_with(key)

    # Test delete
    adapter.delete_data(key)
    mock_client.delete.assert_called_once_with(key)

    # Test exists
    mock_client.exists.return_value = True
    assert adapter.exists(key) is True
    mock_client.exists.assert_called_once_with(key)

    # Test list keys
    mock_client.keys.return_value = [b'key1', b'key2']
    keys = adapter.list_keys(prefix='test-')
    assert keys == ['key1', 'key2']
    mock_client.keys.assert_called_once_with('test-*')


def test_redis_adapter_exceptions(redis_adapter):
    adapter, mock_client = redis_adapter
    key = 'test-key'
    data = 'test-data'

    # Test save with exception
    mock_client.set.side_effect = redis.exceptions.RedisError("Save error")
    with pytest.raises(redis.exceptions.RedisError, match="Save error"):
        adapter.save_data(key, data)

    # Test load with exception
    mock_client.get.side_effect = redis.exceptions.RedisError("Load error")
    with pytest.raises(redis.exceptions.RedisError, match="Load error"):
        adapter.load_data(key)

    # Test delete with exception
    mock_client.delete.side_effect = redis.exceptions.RedisError("Delete error")
    with pytest.raises(redis.exceptions.RedisError, match="Delete error"):
        adapter.delete_data(key)


def test_mongodb_adapter_save_load_delete(mongodb_adapter):
    adapter, mock_client = mongodb_adapter
    key = 'test-key'
    data = {'data': 'test-data'}

    # Test save
    adapter.save_data(key, data)
    mock_client['testdb']['testcollection'].update_one.assert_called_once_with({'_id': key}, {'$set': data},
                                                                               upsert=True)

    # Test load
    mock_client['testdb']['testcollection'].find_one.return_value = {'_id': key, **data}
    loaded_data = adapter.load_data(key)
    assert loaded_data == data
    mock_client['testdb']['testcollection'].find_one.assert_called_once_with({'_id': key})

    # Test delete
    adapter.delete_data(key)
    mock_client['testdb']['testcollection'].delete_one.assert_called_once_with({'_id': key})

    # Test exists
    mock_client['testdb']['testcollection'].find_one.return_value = {'_id': key, **data}
    assert adapter.exists(key) is True
    mock_client['testdb']['testcollection'].find_one.assert_called_with({'_id': key})

    # Test list keys
    mock_client['testdb']['testcollection'].find.return_value = [{'_id': 'key1'}, {'_id': 'key2'}]
    keys = adapter.list_keys(prefix='key')
    assert keys == ['key1', 'key2']
    mock_client['testdb']['testcollection'].find.assert_called_once_with({'_id': {'$regex': '^key'}})


def test_mongodb_adapter_exceptions(mongodb_adapter):
    adapter, mock_client = mongodb_adapter
    key = 'test-key'
    data = {'data': 'test-data'}

    # Test save with exception
    mock_client['testdb']['testcollection'].update_one.side_effect = PyMongoError("Save error")
    with pytest.raises(PyMongoError, match="Save error"):
        adapter.save_data(key, data)

    # Test load with exception
    mock_client['testdb']['testcollection'].find_one.side_effect = PyMongoError("Load error")
    with pytest.raises(PyMongoError, match="Load error"):
        adapter.load_data(key)

    # Test delete with exception
    mock_client['testdb']['testcollection'].delete_one.side_effect = PyMongoError("Delete error")
    with pytest.raises(PyMongoError, match="Delete error"):
        adapter.delete_data(key)


def test_storage_manager(minio_adapter, redis_adapter, mongodb_adapter):
    minio_adapter_instance, _ = minio_adapter
    redis_adapter_instance, _ = redis_adapter
    mongodb_adapter_instance, _ = mongodb_adapter

    manager = StorageManager()
    manager.add_adapter('minio', minio_adapter_instance)
    manager.add_adapter('redis', redis_adapter_instance)
    manager.add_adapter('mongodb', mongodb_adapter_instance)

    key = 'test-key'
    data = b'test-data'
    batch_data = {
        'key1': b'This is some binary data 1',
        'key2': b'This is some binary data 2'
    }

    # Test save data
    manager.save_data(key, data, bucket='test-bucket')
    minio_adapter_instance.save_data.assert_called_once_with(key, data, bucket='test-bucket')
    redis_adapter_instance.save_data.assert_called_once_with(key, data)
    mongodb_adapter_instance.save_data.assert_called_once_with(key, data)

    # Test load data from MinIO
    minio_adapter_instance.load_data.return_value = data
    loaded_data = manager.load_data('minio', key, bucket='test-bucket')
    assert loaded_data == data
    minio_adapter_instance.load_data.assert_called_once_with(key, bucket='test-bucket')

    # Test load data from Redis
    redis_adapter_instance.load_data.return_value = data
    loaded_data = manager.load_data('redis', key)
    assert loaded_data == data
    redis_adapter_instance.load_data.assert_called_once_with(key)

    # Test load data from MongoDB
    mongodb_adapter_instance.load_data.return_value = data
    loaded_data = manager.load_data('mongodb', key)
    assert loaded_data == data
    mongodb_adapter_instance.load_data.assert_called_once_with(key)

    # Test save batch data
    manager.save_batch_data(batch_data, bucket='test-bucket')
    minio_adapter_instance.save_batch_data.assert_called_once_with(batch_data, bucket='test-bucket')
    redis_adapter_instance.save_batch_data.assert_called_once_with(batch_data)
    mongodb_adapter_instance.save_batch_data.assert_called_once_with(batch_data)

    # Test load batch data from MinIO
    minio_adapter_instance.load_batch_data.return_value = batch_data
    loaded_batch_data = manager.load_batch_data('minio', list(batch_data.keys()), bucket='test-bucket')
    assert loaded_batch_data == batch_data
    minio_adapter_instance.load_batch_data.assert_called_once_with(list(batch_data.keys()), bucket='test-bucket')

    # Test delete data
    manager.delete_data(key, bucket='test-bucket')
    minio_adapter_instance.delete_data.assert_called_once_with(key, bucket='test-bucket')
    redis_adapter_instance.delete_data.assert_called_once_with(key)
    mongodb_adapter_instance.delete_data.assert_called_once_with(key)

    # Test delete batch data
    manager.delete_batch_data(list(batch_data.keys()), bucket='test-bucket')
    minio_adapter_instance.delete_batch_data.assert_called_once_with(list(batch_data.keys()), bucket='test-bucket')
    redis_adapter_instance.delete_batch_data.assert_called_once_with(list(batch_data.keys()))
    mongodb_adapter_instance.delete_batch_data.assert_called_once_with(list(batch_data.keys()))
