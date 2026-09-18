import datetime
from flask import Blueprint, request
from backend.database import query_db
from backend.utils.auth_middleware import token_required, role_required, permission_required
from backend.utils.helpers import success_response, error_response

workout_bp = Blueprint('workouts', __name__, url_prefix='/api/workouts')

@workout_bp.route('', methods=['GET'])
@token_required
def list_workout_plans():
    """List all available workout routine plans with exercises."""
    plans = query_db("""
        SELECT wp.*, t.full_name as trainer_name
        FROM workout_plans wp
        LEFT JOIN trainers t ON wp.created_by_trainer_id = t.id
        ORDER BY wp.id DESC
    """)

    for plan in plans:
        exercises = query_db("""
            SELECT * FROM workout_exercises 
            WHERE plan_id = %s 
            ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), order_seq ASC
        """, (plan['id'],))
        plan['exercises'] = exercises

    return success_response(data=plans, message='Workout plans retrieved')

@workout_bp.route('/<int:plan_id>', methods=['GET'])
@token_required
def get_workout_plan(plan_id):
    """Get single workout plan details with grouped exercises."""
    plan = query_db("""
        SELECT wp.*, t.full_name as trainer_name
        FROM workout_plans wp
        LEFT JOIN trainers t ON wp.created_by_trainer_id = t.id
        WHERE wp.id = %s
    """, (plan_id,), one=True)

    if not plan:
        return error_response('Workout plan not found', status_code=404)

    exercises = query_db("""
        SELECT * FROM workout_exercises 
        WHERE plan_id = %s 
        ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), order_seq ASC
    """, (plan_id,))

    # Group exercises by day
    grouped = {}
    for ex in exercises:
        day = ex['day_of_week']
        if day not in grouped:
            grouped[day] = []
        grouped[day].append(ex)

    plan['exercises'] = exercises
    plan['grouped_by_day'] = grouped

    return success_response(data=plan, message='Workout plan details retrieved')

@workout_bp.route('', methods=['POST'])
@token_required
@permission_required('workouts:manage')
def create_workout_plan():
    """Create a new workout routine template with exercises."""
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    goal = data.get('goal', '').strip()
    difficulty = data.get('difficulty', 'Intermediate')
    duration_weeks = int(data.get('duration_weeks', 8))
    description = data.get('description', '').strip()
    exercises = data.get('exercises', [])

    if not name or not goal:
        return error_response('Plan name and goal are required', status_code=400)

    # Determine trainer if caller is trainer
    trainer_id = None
    if hasattr(request, 'current_user') and request.current_user.get('trainer'):
        trainer_id = request.current_user['trainer']['id']

    res = query_db("""
        INSERT INTO workout_plans (name, goal, difficulty, duration_weeks, description, created_by_trainer_id)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (name, goal, difficulty, duration_weeks, description, trainer_id), commit=True)
    plan_id = res['lastrowid']

    # Insert exercises
    for idx, ex in enumerate(exercises):
        query_db("""
            INSERT INTO workout_exercises 
            (plan_id, day_of_week, exercise_name, muscle_group, sets, reps, rest_seconds, notes, order_seq)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            plan_id,
            ex.get('day_of_week', 'Monday'),
            ex.get('exercise_name', 'Compound Lift'),
            ex.get('muscle_group', 'General'),
            int(ex.get('sets', 3)),
            str(ex.get('reps', '10-12')),
            int(ex.get('rest_seconds', 60)),
            ex.get('notes', ''),
            idx + 1
        ), commit=True)

    return success_response(data={'plan_id': plan_id}, message=f'Workout plan "{name}" created successfully', status_code=201)

@workout_bp.route('/assign', methods=['POST'])
@token_required
@permission_required('workouts:manage')
def assign_workout():
    """Assign a workout plan to a member."""
    data = request.get_json(silent=True) or {}
    member_id = data.get('member_id')
    plan_id = data.get('plan_id')
    notes = data.get('notes', 'Personalized assignment')

    if not member_id or not plan_id:
        return error_response('Member ID and Plan ID are required', status_code=400)

    # Deactivate previous active workout plans
    query_db("UPDATE member_workout_assignments SET status = 'completed' WHERE member_id = %s", (member_id,), commit=True)

    today = datetime.date.today().isoformat()
    query_db("""
        INSERT INTO member_workout_assignments (member_id, plan_id, assigned_date, status, notes)
        VALUES (%s, %s, %s, 'active', %s)
    """, (member_id, plan_id, today, notes), commit=True)

    # Notify member
    member = query_db("SELECT user_id, full_name FROM members WHERE id = %s", (member_id,), one=True)
    plan = query_db("SELECT name FROM workout_plans WHERE id = %s", (plan_id,), one=True)
    if member and member['user_id']:
        query_db("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s, 'New Workout Routine Assigned', %s, 'info')
        """, (member['user_id'], f"You have been assigned the '{plan['name']}' routine."), commit=True)

    return success_response(message=f"Workout plan assigned to {member['full_name']} successfully")

@workout_bp.route('/member/<int:member_id>', methods=['GET'])
@token_required
def get_member_workout(member_id):
    """Retrieve active workout plan for member."""
    if request.current_user['role'] == 'member':
        member_rec = query_db("SELECT id FROM members WHERE user_id = %s", (request.current_user['id'],), one=True)
        if not member_rec or member_rec['id'] != member_id:
            return error_response('Access forbidden', status_code=403)

    assignment = query_db("""
        SELECT wp.*, mwa.assigned_date, mwa.notes as assignment_notes, t.full_name as trainer_name
        FROM member_workout_assignments mwa
        JOIN workout_plans wp ON mwa.plan_id = wp.id
        LEFT JOIN trainers t ON wp.created_by_trainer_id = t.id
        WHERE mwa.member_id = %s AND mwa.status = 'active'
        ORDER BY mwa.id DESC LIMIT 1
    """, (member_id,), one=True)

    if not assignment:
        return success_response(data=None, message='No active workout plan assigned yet')

    exercises = query_db("""
        SELECT * FROM workout_exercises 
        WHERE plan_id = %s 
        ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), order_seq ASC
    """, (assignment['id'],))

    grouped = {}
    for ex in exercises:
        day = ex['day_of_week']
        if day not in grouped:
            grouped[day] = []
        grouped[day].append(ex)

    assignment['exercises'] = exercises
    assignment['grouped_by_day'] = grouped

    return success_response(data=assignment, message='Active workout plan retrieved')
