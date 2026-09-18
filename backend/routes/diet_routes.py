import datetime
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required
from backend.utils.helpers import success_response, error_response

diet_bp = Blueprint('diets', __name__, url_prefix='/api/diets')

@diet_bp.route('', methods=['GET'])
@token_required
def list_diet_plans():
    """List all diet plans with meals."""
    plans = query_db("""
        SELECT dp.*, t.full_name as trainer_name
        FROM diet_plans dp
        LEFT JOIN trainers t ON dp.created_by_trainer_id = t.id
        ORDER BY dp.id ASC
    """)

    for plan in plans:
        meals = query_db("""
            SELECT * FROM diet_meals 
            WHERE plan_id = %s 
            ORDER BY order_seq ASC
        """, (plan['id'],))
        plan['meals'] = meals

    return success_response(data=plans, message='Diet plans retrieved')

@diet_bp.route('/<int:plan_id>', methods=['GET'])
@token_required
def get_diet_plan(plan_id):
    """Get single diet plan with meal details."""
    plan = query_db("""
        SELECT dp.*, t.full_name as trainer_name
        FROM diet_plans dp
        LEFT JOIN trainers t ON dp.created_by_trainer_id = t.id
        WHERE dp.id = %s
    """, (plan_id,), one=True)

    if not plan:
        return error_response('Diet plan not found', status_code=404)

    meals = query_db("SELECT * FROM diet_meals WHERE plan_id = %s ORDER BY order_seq ASC", (plan_id,))
    plan['meals'] = meals

    return success_response(data=plan, message='Diet plan details retrieved')

@diet_bp.route('', methods=['POST'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def create_diet_plan():
    """Create a new diet plan template with meal schedules."""
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    goal = data.get('goal', '').strip()
    calorie_target = int(data.get('calorie_target', 2000))
    protein_g = int(data.get('protein_g', 150))
    carbs_g = int(data.get('carbs_g', 200))
    fats_g = int(data.get('fats_g', 60))
    description = data.get('description', '').strip()
    meals = data.get('meals', [])

    if not name or not goal:
        return error_response('Plan name and goal are required', status_code=400)

    trainer_id = None
    if hasattr(request, 'current_user') and request.current_user.get('trainer'):
        trainer_id = request.current_user['trainer']['id']

    res = query_db("""
        INSERT INTO diet_plans (name, goal, calorie_target, protein_g, carbs_g, fats_g, description, created_by_trainer_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (name, goal, calorie_target, protein_g, carbs_g, fats_g, description, trainer_id), commit=True)
    plan_id = res['lastrowid']

    # Insert meals
    for idx, meal in enumerate(meals):
        query_db("""
            INSERT INTO diet_meals 
            (plan_id, meal_type, meal_name, calories, protein_g, carbs_g, fats_g, timing, instructions, order_seq)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            plan_id,
            meal.get('meal_type', 'Breakfast'),
            meal.get('meal_name', 'Nutrient Rich Meal'),
            int(meal.get('calories', 400)),
            int(meal.get('protein_g', 30)),
            int(meal.get('carbs_g', 40)),
            int(meal.get('fats_g', 12)),
            meal.get('timing', '08:00 AM'),
            meal.get('instructions', ''),
            idx + 1
        ), commit=True)

    return success_response(data={'plan_id': plan_id}, message=f'Diet plan "{name}" created successfully', status_code=201)

@diet_bp.route('/assign', methods=['POST'])
@token_required
@role_required(['admin', 'staff', 'trainer'])
def assign_diet():
    """Assign a diet plan to a member."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    plan_id = data.get('plan_id')
    notes = data.get('notes', 'Personalized dietary blueprint')

    if not member_id or not plan_id:
        return error_response('Member ID and Plan ID are required', status_code=400)

    query_db("UPDATE member_diet_assignments SET status = 'completed' WHERE member_id = %s", (member_id,), commit=True)

    today = datetime.date.today().isoformat()
    query_db("""
        INSERT INTO member_diet_assignments (member_id, plan_id, assigned_date, status, notes)
        VALUES (%s, %s, %s, 'active', %s)
    """, (member_id, plan_id, today, notes), commit=True)

    member = query_db("SELECT user_id, full_name FROM members WHERE id = %s", (member_id,), one=True)
    plan = query_db("SELECT name FROM diet_plans WHERE id = %s", (plan_id,), one=True)
    if member and member['user_id']:
        query_db("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s, 'New Nutrition Blueprint Assigned', %s, 'info')
        """, (member['user_id'], f"Your trainer assigned the '{plan['name']}' nutrition plan."), commit=True)

    return success_response(message=f"Diet plan assigned to {member['full_name']} successfully")

@diet_bp.route('/member/<int:member_id>', methods=['GET'])
@token_required
def get_member_diet(member_id):
    """Retrieve active diet plan for member."""
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != member_id:
            return error_response('Access forbidden', status_code=403)

    assignment = query_db("""
        SELECT dp.*, mda.assigned_date, mda.notes as assignment_notes, t.full_name as trainer_name
        FROM member_diet_assignments mda
        JOIN diet_plans dp ON mda.plan_id = dp.id
        LEFT JOIN trainers t ON dp.created_by_trainer_id = t.id
        WHERE mda.member_id = %s AND mda.status = 'active'
        ORDER BY mda.id DESC LIMIT 1
    """, (member_id,), one=True)

    if not assignment:
        return success_response(data=None, message='No active diet plan assigned yet')

    meals = query_db("SELECT * FROM diet_meals WHERE plan_id = %s ORDER BY order_seq ASC", (assignment['id'],))
    assignment['meals'] = meals

    return success_response(data=assignment, message='Active diet plan retrieved')
