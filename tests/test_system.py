import sys
import unittest
from pathlib import Path

# Add root directory to python path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app import create_app
from backend.database import query_db, init_database

class SystemIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize test app
        cls.app = create_app()
        cls.client = cls.app.test_client()
        # Ensure fresh seed state
        init_database(force_seed=True)

    def test_01_static_pages(self):
        """Verify that frontend pages are served properly."""
        for path in ['/', '/login', '/admin', '/member']:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200, f"Failed serving {path}")

    def test_02_auth_admin_login(self):
        """Verify Admin login and JWT token generation."""
        res = self.client.post('/api/auth/login', json={
            'email': 'admin@apexgym.com',
            'password': 'Admin@123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('token', data['data'])
        self.assertEqual(data['data']['user']['role'], 'admin')
        self.__class__.admin_token = data['data']['token']

    def test_03_auth_member_login(self):
        """Verify Member login and profile attachment."""
        res = self.client.post('/api/auth/login', json={
            'email': 'alex@apexgym.com',
            'password': 'Member@123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'member')
        self.assertIsNotNone(data['data']['user']['profile'])
        self.__class__.member_token = data['data']['token']

    def test_04_auth_invalid_credentials(self):
        """Verify rejection of wrong passwords."""
        res = self.client.post('/api/auth/login', json={
            'email': 'admin@apexgym.com',
            'password': 'WrongPassword123'
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data['success'])

    def test_04b_auth_register_member(self):
        """Verify public member self-registration with Student Scholar Pass."""
        reg_payload = {
            'full_name': 'Kavitha Raman',
            'email': 'kavitha.student@college.edu',
            'password': 'Student@2026',
            'phone': '+91 98401 23456',
            'gender': 'female',
            'plan_id': 5,
            'is_student': True,
            'student_id': 'ANNA-UNIV-CS-2024'
        }
        res = self.client.post('/api/auth/register', json=reg_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('token', data['data'])
        self.assertEqual(data['data']['user']['role'], 'member')
        self.assertTrue(data['data']['member_code'].startswith('APX-'))
        self.assertEqual(data['data']['user']['profile']['full_name'], 'Kavitha Raman')

        # Verify new user can immediately log in
        login_res = self.client.post('/api/auth/login', json={
            'email': 'kavitha.student@college.edu',
            'password': 'Student@2026'
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertTrue(login_data['success'])
        self.assertEqual(login_data['data']['user']['email'], 'kavitha.student@college.edu')

    def test_04c_auth_register_validation(self):
        """Verify duplicate email rejection and password length validation."""
        # 1. Duplicate email rejection
        res_dup = self.client.post('/api/auth/register', json={
            'full_name': 'Duplicate User',
            'email': 'kavitha.student@college.edu',
            'password': 'Password@123'
        })
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn('already exists', res_dup.get_json()['message'])

        # 2. Short password rejection
        res_short = self.client.post('/api/auth/register', json={
            'full_name': 'Short Pass',
            'email': 'shortpass@example.com',
            'password': '123'
        })
        self.assertEqual(res_short.status_code, 400)

    def test_05_dashboard_stats(self):
        """Verify admin dashboard statistics queries."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        res = self.client.get('/api/dashboard/stats', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertGreater(data['data']['total_members'], 0)
        self.assertGreater(data['data']['monthly_revenue'], 0)

    def test_06_dashboard_charts(self):
        """Verify Chart.js datasets are generated."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        res = self.client.get('/api/dashboard/charts', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('revenue_chart', data['data'])
        self.assertIn('attendance_chart', data['data'])
        self.assertIn('plan_chart', data['data'])

    def test_07_member_crud(self):
        """Verify Member registration, lookup, update, and search."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        
        # 1. Create member
        new_member = {
            'full_name': 'Test Athlete',
            'email': 'athlete_test@apexgym.com',
            'phone': '+1 (555) 999-8877',
            'gender': 'male',
            'date_of_birth': '1996-03-15',
            'emergency_contact': 'Sarah Test (+1 555-999-1111)',
            'address': '550 Broadway, NY',
            'plan_id': 2, # Gold Performance
            'password': 'Member@123'
        }
        res = self.client.post('/api/members', json=new_member, headers=headers)
        self.assertEqual(res.status_code, 201)
        created = res.get_json()['data']
        member_id = created['member_id']

        # 2. Get member details
        res_get = self.client.get(f'/api/members/{member_id}', headers=headers)
        self.assertEqual(res_get.status_code, 200)
        m_data = res_get.get_json()['data']
        self.assertEqual(m_data['full_name'], 'Test Athlete')
        self.assertEqual(len(m_data['memberships']), 1)

        # 3. Update member
        res_put = self.client.put(f'/api/members/{member_id}', json={'emergency_contact': 'Updated Contact'}, headers=headers)
        self.assertEqual(res_put.status_code, 200)

        # 4. Search member
        res_search = self.client.get('/api/members?search=Test%20Athlete', headers=headers)
        self.assertEqual(res_search.status_code, 200)
        self.assertGreater(len(res_search.get_json()['data']), 0)

    def test_08_attendance_checkin_and_duplicate_prevention(self):
        """Verify check-in flow and duplicate prevention."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # Check in Sarah Connor (APX-1002) if not checked in today
        res = self.client.post('/api/attendance/check-in', json={'member_code': 'APX-1002'}, headers=headers)
        # In seed data, APX-1002 already checked in today, so this should trigger duplicate rejection!
        self.assertEqual(res.status_code, 409, "Duplicate check-in should return 409 Conflict")

    def test_09_payment_and_receipt(self):
        """Verify payment recording and receipt invoice data."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # List payments
        res = self.client.get('/api/payments', headers=headers)
        self.assertEqual(res.status_code, 200)
        payments = res.get_json()['data']
        self.assertGreater(len(payments), 0)

        # Fetch receipt for first payment
        payment_id = payments[0]['id']
        receipt_res = self.client.get(f'/api/payments/{payment_id}/receipt', headers=headers)
        self.assertEqual(receipt_res.status_code, 200)
        receipt_data = receipt_res.get_json()['data']
        self.assertIn('gym_info', receipt_data)
        self.assertEqual(receipt_data['payment']['id'], payment_id)

    def test_10_workouts_and_diets(self):
        """Verify workout and diet blueprints."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # Workouts
        res_w = self.client.get('/api/workouts', headers=headers)
        self.assertEqual(res_w.status_code, 200)
        workouts = res_w.get_json()['data']
        self.assertGreater(len(workouts), 0)

        # Diets
        res_d = self.client.get('/api/diets', headers=headers)
        self.assertEqual(res_d.status_code, 200)
        diets = res_d.get_json()['data']
        self.assertGreater(len(diets), 0)

        # Member 1 active workout & diet
        res_mw = self.client.get('/api/workouts/member/1', headers={'Authorization': f"Bearer {self.member_token}"})
        self.assertEqual(res_mw.status_code, 200)
        self.assertIsNotNone(res_mw.get_json()['data'])

    def test_11_attendance_checkout(self):
        """Verify checkout time recording."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        # Check out Alex Rivera (Attendance ID 1 in seed today)
        res = self.client.post('/api/attendance/check-out', json={'attendance_id': 1}, headers=headers)
        # Alex Rivera already had checkout in seed or can check out Jordan or Liam (ID 4 or 5)
        # If already checked out, status_code is 400 with 'Already checked out', otherwise 200
        self.assertIn(res.status_code, [200, 400])

    def test_12_reports_csv_exports(self):
        """Verify CSV reports generation and downloads."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        
        # 1. Export Payments
        res_p = self.client.get('/api/reports/export/payments', headers=headers)
        self.assertEqual(res_p.status_code, 200)
        self.assertIn('text/csv', res_p.headers.get('Content-Type', ''))
        self.assertIn('Invoice No', res_p.data.decode('utf-8'))

        # 2. Export Attendance
        res_a = self.client.get('/api/reports/export/attendance', headers=headers)
        self.assertEqual(res_a.status_code, 200)
        self.assertIn('text/csv', res_a.headers.get('Content-Type', ''))
        self.assertIn('Member Name', res_a.data.decode('utf-8'))

    def test_13_notifications(self):
        """Verify notifications retrieval and mark-read."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        res = self.client.get('/api/notifications', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertIn('notifications', data['data'])

        # Mark all read
        res_read = self.client.put('/api/notifications/read-all', headers=headers)
        self.assertEqual(res_read.status_code, 200)

    def test_14_trainer_badges(self):
        """Verify trainer digital badges and QR payloads."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        res = self.client.get('/api/trainers/badges', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertGreater(len(data['data']), 0)
        first_badge = data['data'][0]
        self.assertIn('trainer_code', first_badge)
        self.assertIn('qr_payload', first_badge)
        self.assertTrue(first_badge['qr_payload'].startswith('APEX:TRAINER:'))

    def test_15_trainer_qr_dual_scan_flow(self):
        """Verify dual-scan workflow: Scan 1 (In-Time), Scan 2 (Out-Time), Scan 3 (Already Completed)."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # 1. Scan 1: Check In for David Chen (TRN-003)
        res1 = self.client.post('/api/attendance/trainers/scan', json={'trainer_code': 'TRN-003'}, headers=headers)
        self.assertEqual(res1.status_code, 200)
        d1 = res1.get_json()
        self.assertTrue(d1['success'])
        self.assertEqual(d1['data']['action'], 'check_in')
        self.assertIsNotNone(d1['data']['in_time'])
        self.assertEqual(d1['data']['trainer']['trainer_code'], 'TRN-003')

        # 2. Scan 2: Check Out for David Chen (TRN-003)
        res2 = self.client.post('/api/attendance/trainers/scan', json={'trainer_code': 'TRN-003'}, headers=headers)
        self.assertEqual(res2.status_code, 200)
        d2 = res2.get_json()
        self.assertTrue(d2['success'])
        self.assertEqual(d2['data']['action'], 'check_out')
        self.assertIsNotNone(d2['data']['out_time'])
        self.assertIsNotNone(d2['data']['total_hours'])

        # 3. Scan 3: Try to scan again -> should detect already completed
        res3 = self.client.post('/api/attendance/trainers/scan', json={'trainer_code': 'TRN-003'}, headers=headers)
        self.assertEqual(res3.status_code, 200)
        d3 = res3.get_json()
        self.assertTrue(d3['success'])
        self.assertEqual(d3['data']['action'], 'already_completed')

        # 4. Test Reset Shift for Demo
        res_reset = self.client.post('/api/attendance/trainers/reset-shift/3', headers=headers)
        self.assertEqual(res_reset.status_code, 200)
        self.assertTrue(res_reset.get_json()['success'])

        # 5. Verify trainer can clock in again after reset
        res_re_scan = self.client.post('/api/attendance/trainers/scan', json={'trainer_code': 'TRN-003'}, headers=headers)
        self.assertEqual(res_re_scan.status_code, 200)
        self.assertEqual(res_re_scan.get_json()['data']['action'], 'check_in')

    def test_16_trainer_qr_prefix_and_today_roster(self):
        """Verify QR scanner handles APEX:TRAINER: prefix and today's roster reflects shifts."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # TRN-001 (Marcus Vance) was seeded with active shift (in_time present, out_time None)
        # Scan using the full QR format
        res = self.client.post('/api/attendance/trainers/scan', json={'trainer_code': 'APEX:TRAINER:TRN-001'}, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['data']['action'], 'check_out')

        # Check today's shift roster
        res_today = self.client.get('/api/attendance/trainers/today', headers=headers)
        self.assertEqual(res_today.status_code, 200)
        today_data = res_today.get_json()
        self.assertTrue(today_data['success'])
        summary = today_data['data']['summary']
        self.assertIn('active_shifts', summary)
        self.assertIn('completed_shifts', summary)
        self.assertIn('total_trainers', summary)

    def test_17_trainer_history_and_invalid_code(self):
        """Verify historical shifts querying and error handling on invalid trainer code."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # Query history
        res_hist = self.client.get('/api/attendance/trainers/history', headers=headers)
        self.assertEqual(res_hist.status_code, 200)
        hist_data = res_hist.get_json()
        self.assertTrue(hist_data['success'])
        self.assertIsInstance(hist_data['data'], list)

        # Invalid trainer scan
        res_inv = self.client.post('/api/attendance/trainers/scan', json={'trainer_code': 'NON_EXISTENT_999'}, headers=headers)
        self.assertEqual(res_inv.status_code, 404)
        self.assertFalse(res_inv.get_json()['success'])

    def test_18_member_badges(self):
        """Verify student & member digital badges and QR payloads."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}
        res = self.client.get('/api/members/badges', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertGreater(len(data['data']), 0)
        first_badge = data['data'][0]
        self.assertIn('member_code', first_badge)
        self.assertIn('qr_payload', first_badge)
        self.assertTrue(first_badge['qr_payload'].startswith('APEX:MEMBER:'))

    def test_19_attendance_mark_present_and_absent(self):
        """Verify roll-call endpoint: marking members present and absent."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # 1. Mark member 3 (Marcus Brody APX-1003) as absent
        res_abs = self.client.post('/api/attendance/mark', json={
            'member_id': 3,
            'status': 'absent',
            'notes': 'Medical leave / Flu'
        }, headers=headers)
        self.assertEqual(res_abs.status_code, 200)
        d_abs = res_abs.get_json()
        self.assertTrue(d_abs['success'])
        self.assertEqual(d_abs['data']['status'], 'absent')
        self.assertIsNone(d_abs['data']['check_in_time'])

        # 2. Update to present (e.g. member arrived later)
        res_pres = self.client.post('/api/attendance/mark', json={
            'member_id': 3,
            'status': 'present',
            'notes': 'Late arrival approved'
        }, headers=headers)
        self.assertEqual(res_pres.status_code, 200)
        d_pres = res_pres.get_json()
        self.assertTrue(d_pres['success'])
        self.assertEqual(d_pres['data']['status'], 'present')
        self.assertIsNotNone(d_pres['data']['check_in_time'])

    def test_20_attendance_edit_record(self):
        """Verify PUT /api/attendance/<id> modifies status, times, and remarks."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # Attendance record ID 1 exists in seed
        res_edit = self.client.put('/api/attendance/1', json={
            'status': 'late',
            'check_in_time': '07:45:00',
            'check_out_time': '09:15:00',
            'notes': 'Manual correction by manager'
        }, headers=headers)
        self.assertEqual(res_edit.status_code, 200)
        data = res_edit.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['status'], 'late')
        self.assertEqual(data['data']['check_in_time'], '07:45:00')
        self.assertEqual(data['data']['notes'], 'Manual correction by manager')

    def test_21_attendance_delete_record(self):
        """Verify DELETE /api/attendance/<id> deletes record with authorization check."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # Create a temporary attendance record to delete
        res_create = self.client.post('/api/attendance/mark', json={
            'member_id': 8,
            'status': 'absent',
            'notes': 'Temporary record for delete test'
        }, headers=headers)
        rec_id = res_create.get_json()['data']['attendance_id']

        # Delete it
        res_del = self.client.delete(f"/api/attendance/{rec_id}", headers=headers)
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.get_json()['success'])

        # Verify not found if deleting again
        res_del2 = self.client.delete(f"/api/attendance/{rec_id}", headers=headers)
        self.assertEqual(res_del2.status_code, 404)

    def test_22_member_smart_scan_turnstile(self):
        """Verify member optical QR scan turnstile dual-scan flow."""
        headers = {'Authorization': f"Bearer {self.admin_token}"}

        # Member 6 (Tyler Reed APX-1006)
        # Scan 1: Check In
        res1 = self.client.post('/api/attendance/scan', json={'member_code': 'APEX:MEMBER:APX-1006'}, headers=headers)
        self.assertEqual(res1.status_code, 200)
        d1 = res1.get_json()
        self.assertTrue(d1['success'])
        self.assertEqual(d1['data']['action'], 'check_in')
        self.assertEqual(d1['data']['status'], 'present')
        self.assertIsNotNone(d1['data']['in_time'])

        # Scan 2: Check Out
        res2 = self.client.post('/api/attendance/scan', json={'member_code': 'APX-1006'}, headers=headers)
        self.assertEqual(res2.status_code, 200)
        d2 = res2.get_json()
        self.assertTrue(d2['success'])
        self.assertEqual(d2['data']['action'], 'check_out')
        self.assertIsNotNone(d2['data']['out_time'])

        # Scan 3: Already completed
        res3 = self.client.post('/api/attendance/scan', json={'member_code': 'APX-1006'}, headers=headers)
        self.assertEqual(res3.status_code, 200)
        d3 = res3.get_json()
        self.assertTrue(d3['success'])
        self.assertEqual(d3['data']['action'], 'already_completed')

    def test_23_staff_login_and_profile(self):
        """Verify new Staff account login, role assignment, and permissions list."""
        res = self.client.post('/api/auth/login', json={
            'email': 'staff@apexgym.com',
            'password': 'Staff@123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'staff')
        self.assertIn('permissions', data['data']['user'])
        self.assertIn('members:create', data['data']['user']['permissions'])
        self.assertIn('payments:create', data['data']['user']['permissions'])
        self.__class__.staff_token = data['data']['token']

    def test_24_trainer_login_and_permissions(self):
        """Verify Trainer login permissions: has workout management, lacks payment recording."""
        res = self.client.post('/api/auth/login', json={
            'email': 'marcus@apexgym.com',
            'password': 'Trainer@123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['user']['role'], 'trainer')
        self.assertIn('workouts:manage', data['data']['user']['permissions'])
        self.assertNotIn('payments:create', data['data']['user']['permissions'])
        self.assertNotIn('payments:view', data['data']['user']['permissions'])
        self.__class__.trainer_token = data['data']['token']

    def test_25_permissions_api_and_matrix_update(self):
        """Verify GET & PUT /api/auth/permissions with role guards."""
        admin_headers = {'Authorization': f"Bearer {self.admin_token}"}
        staff_headers = {'Authorization': f"Bearer {self.staff_token}"}

        # 1. GET permissions as Admin
        res = self.client.get('/api/auth/permissions', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertGreaterEqual(len(data['data']['definitions']), 23)
        self.assertIn('staff', data['data']['matrix'])
        self.assertIn('trainer', data['data']['matrix'])

        # 2. PUT permissions as non-admin Staff should fail with 403
        res_fail = self.client.put('/api/auth/permissions', json={
            'updates': [{'role': 'trainer', 'permission_key': 'payments:view', 'is_granted': True}]
        }, headers=staff_headers)
        self.assertEqual(res_fail.status_code, 403)

        # 3. PUT permissions as Admin should succeed
        res_ok = self.client.put('/api/auth/permissions', json={
            'updates': [{'role': 'trainer', 'permission_key': 'payments:view', 'is_granted': True}]
        }, headers=admin_headers)
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.get_json()['success'])

        # Verify change reflected in matrix
        res_verify = self.client.get('/api/auth/permissions', headers=admin_headers)
        self.assertIn('payments:view', res_verify.get_json()['data']['matrix']['trainer'])

        # Reset back: revoke payments:view from trainer
        self.client.put('/api/auth/permissions', json={
            'updates': [{'role': 'trainer', 'permission_key': 'payments:view', 'is_granted': False}]
        }, headers=admin_headers)

    def test_26_role_permission_middleware_enforcement(self):
        """Verify granular @permission_required blocks disallowed actions and permits authorized ones."""
        trainer_headers = {'Authorization': f"Bearer {self.trainer_token}"}
        staff_headers = {'Authorization': f"Bearer {self.staff_token}"}

        # 1. Trainer attempts to record payment -> 403 Forbidden (missing payments:create)
        res_blocked = self.client.post('/api/payments', json={
            'member_id': 1,
            'membership_id': 1,
            'amount': 150.00,
            'payment_method': 'card'
        }, headers=trainer_headers)
        self.assertEqual(res_blocked.status_code, 403)
        self.assertIn('Missing permission', res_blocked.get_json()['message'])

        # 2. Staff attempts to list payments -> Allowed 200 (has payments:view)
        res_allowed = self.client.get('/api/payments', headers=staff_headers)
        self.assertEqual(res_allowed.status_code, 200)
        self.assertTrue(res_allowed.get_json()['success'])

        # 3. Trainer attempts to export reports CSV -> 403 Forbidden (missing reports:export)
        res_export_blocked = self.client.get('/api/reports/export/payments', headers=trainer_headers)
        self.assertEqual(res_export_blocked.status_code, 403)

if __name__ == '__main__':
    unittest.main()
