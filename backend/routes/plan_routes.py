import json
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response, error_response

plan_bp = Blueprint('plans', __name__, url_prefix='/api/plans')

@plan_bp.route('', methods=['GET'])
def list_plans():
    """List membership plans. Publicly available for landing page and booking."""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    
    if include_inactive:
        sql = "SELECT * FROM membership_plans ORDER BY duration_months ASC"
        plans = query_db(sql)
    else:
        sql = "SELECT * FROM membership_plans WHERE is_active = TRUE ORDER BY duration_months ASC"
        plans = query_db(sql)

    # Parse features JSON/text
    for plan in plans:
        if isinstance(plan.get('features'), str):
            try:
                plan['features_list'] = json.loads(plan['features'])
            except Exception:
                plan['features_list'] = [f.strip() for f in plan['features'].split('\n') if f.strip()]
        else:
            plan['features_list'] = plan.get('features') or []

    return success_response(data=plans, message='Plans retrieved')

@plan_bp.route('/<int:plan_id>', methods=['GET'])
def get_plan(plan_id):
    """Get single plan details."""
    plan = query_db("SELECT * FROM membership_plans WHERE id = %s", (plan_id,), one=True)
    if not plan:
        return error_response('Plan not found', status_code=404)

    if isinstance(plan.get('features'), str):
        try:
            plan['features_list'] = json.loads(plan['features'])
        except Exception:
            plan['features_list'] = [f.strip() for f in plan['features'].split('\n') if f.strip()]
    return success_response(data=plan, message='Plan retrieved')

@plan_bp.route('', methods=['POST'])
@token_required
@role_required(['admin'])
def create_plan():
    """Create a new membership plan."""
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    code = data.get('code', '').strip().upper()
    duration_months = int(data.get('duration_months', 1))
    price = float(data.get('price', 0))
    description = data.get('description', '').strip()
    features = data.get('features', '[]')
    badge = data.get('badge', '').strip() or None

    if not name or not code or price <= 0:
        return error_response('Name, unique code, and a valid positive price are required', status_code=400)

    # If features is a list, convert to json string
    if isinstance(features, list):
        features = json.dumps(features)

    res = query_db("""
        INSERT INTO membership_plans (name, code, duration_months, price, description, features, badge, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
    """, (name, code, duration_months, price, description, features, badge), commit=True)

    return success_response(
        data={'plan_id': res['lastrowid']},
        message=f'Plan "{name}" created successfully',
        status_code=201
    )

@plan_bp.route('/<int:plan_id>', methods=['PUT'])
@token_required
@role_required(['admin'])
def update_plan(plan_id):
    """Update existing membership plan."""
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    duration_months = data.get('duration_months')
    price = data.get('price')
    description = data.get('description')
    features = data.get('features')
    badge = data.get('badge')
    is_active = data.get('is_active')

    if isinstance(features, list):
        features = json.dumps(features)

    query_db("""
        UPDATE membership_plans
        SET name = COALESCE(%s, name),
            duration_months = COALESCE(%s, duration_months),
            price = COALESCE(%s, price),
            description = COALESCE(%s, description),
            features = COALESCE(%s, features),
            badge = %s,
            is_active = COALESCE(%s, is_active)
        WHERE id = %s
    """, (name, duration_months, price, description, features, badge, is_active, plan_id), commit=True)

    return success_response(message='Plan updated successfully')

@plan_bp.route('/<int:plan_id>', methods=['DELETE'])
@token_required
@role_required(['admin'])
def delete_plan(plan_id):
    """Deactivate membership plan."""
    query_db("UPDATE membership_plans SET is_active = FALSE WHERE id = %s", (plan_id,), commit=True)
    return success_response(message='Plan deactivated successfully')
