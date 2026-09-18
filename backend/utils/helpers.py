import datetime
import decimal
import random
import string
from flask import jsonify
from backend.config import Config

def serialize_data(data):
    """Recursively convert datetime, date, time, and Decimal to JSON serializable formats."""
    if isinstance(data, list):
        return [serialize_data(item) for item in data]
    elif isinstance(data, dict):
        return {key: serialize_data(value) for key, value in data.items()}
    elif isinstance(data, (datetime.datetime, datetime.date)):
        return data.isoformat()
    elif isinstance(data, datetime.time):
        return data.strftime('%H:%M:%S')
    elif isinstance(data, datetime.timedelta):
        total_sec = int(data.total_seconds())
        h, m = divmod(total_sec, 3600)
        m, s = divmod(m, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
    elif isinstance(data, decimal.Decimal):
        return float(data)
    return data

def success_response(data=None, message="Success", status_code=200, **kwargs):
    """Standardized API success response."""
    response = {
        'success': True,
        'message': message,
        'data': serialize_data(data)
    }
    for k, v in kwargs.items():
        response[k] = serialize_data(v)
    return jsonify(response), status_code

def error_response(message="An error occurred", errors=None, status_code=400):
    """Standardized API error response."""
    response = {
        'success': False,
        'message': message
    }
    if errors:
        response['errors'] = serialize_data(errors)
    return jsonify(response), status_code

def generate_invoice_no():
    """Generate professional invoice number: INV-YYYYMM-XXXX."""
    now = datetime.datetime.now()
    rand_chars = ''.join(random.choices(string.digits, k=4))
    return f"INV-{now.strftime('%Y%m')}-{rand_chars}"

def generate_member_code():
    """Generate unique member code: APX-XXXX."""
    rand_chars = ''.join(random.choices(string.digits, k=4))
    return f"APX-{rand_chars}"

def allowed_file(filename):
    """Check if the uploaded file has an allowed image extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
