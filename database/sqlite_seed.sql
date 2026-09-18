PRAGMA foreign_keys = OFF;
-- ==========================================================
-- APEX FITNESS CLUB - SEED DATA
-- Comprehensive Realistic Production Data for Local Dev & Demo
-- ==========================================================


-- Clear existing data if re-seeding
DELETE FROM `notifications`;
DELETE FROM `member_diet_assignments`;
DELETE FROM `diet_meals`;
DELETE FROM `diet_plans`;
DELETE FROM `member_workout_assignments`;
DELETE FROM `workout_exercises`;
DELETE FROM `workout_plans`;
DELETE FROM `payments`;
DELETE FROM `attendance`;
DELETE FROM `trainer_attendance`;
DELETE FROM `trainer_assignments`;
DELETE FROM `memberships`;
DELETE FROM `members`;
DELETE FROM `membership_plans`;
DELETE FROM `trainers`;
DELETE FROM `role_permissions`;
DELETE FROM `users`;

-- 1. USERS
-- Passwords:
-- Admin@123   -> scrypt:32768:8:1$x5MXAjkqEbNk4JTa$8fdb5f8087b880b6377a8ca7855d42faf99011ece83c4efc3645b53572a2e77be7064077b039c1316dff4bcf93a218eaba1795f09a7abf4bfbb5d4714eed9593
-- Trainer@123 -> scrypt:32768:8:1$QUmOEyTfqqf3v0GN$5632d4edad8a2e044d41d733d581e0eb954cf4db2605b0be17a993b22e102b5a245c71652d80633465845383b006e82f6b459386012e03025c7394bdd17a7d0f
-- Member@123  -> scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17

INSERT INTO `users` (`id`, `email`, `password_hash`, `role`, `status`) VALUES
(1, 'admin@apexgym.com', 'scrypt:32768:8:1$x5MXAjkqEbNk4JTa$8fdb5f8087b880b6377a8ca7855d42faf99011ece83c4efc3645b53572a2e77be7064077b039c1316dff4bcf93a218eaba1795f09a7abf4bfbb5d4714eed9593', 'admin', 'active'),
(2, 'marcus@apexgym.com', 'scrypt:32768:8:1$QUmOEyTfqqf3v0GN$5632d4edad8a2e044d41d733d581e0eb954cf4db2605b0be17a993b22e102b5a245c71652d80633465845383b006e82f6b459386012e03025c7394bdd17a7d0f', 'trainer', 'active'),
(3, 'elena@apexgym.com', 'scrypt:32768:8:1$QUmOEyTfqqf3v0GN$5632d4edad8a2e044d41d733d581e0eb954cf4db2605b0be17a993b22e102b5a245c71652d80633465845383b006e82f6b459386012e03025c7394bdd17a7d0f', 'trainer', 'active'),
(4, 'david@apexgym.com', 'scrypt:32768:8:1$QUmOEyTfqqf3v0GN$5632d4edad8a2e044d41d733d581e0eb954cf4db2605b0be17a993b22e102b5a245c71652d80633465845383b006e82f6b459386012e03025c7394bdd17a7d0f', 'trainer', 'active'),
(5, 'alex@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(6, 'sarah@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(7, 'jordan@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(8, 'samantha@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(9, 'liam@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(10, 'maya@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(11, 'carlos@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(12, 'emily@apexgym.com', 'scrypt:32768:8:1$2J70yZ5SuqWavFMX$9338918ee540d5a0eac02ef806a102df34a3b11e6c578ef6f9dfa716f1f1f67a4ebe3d151a5595c875720dd371865320be8a6834446ff2028fe7d550747dab17', 'member', 'active'),
(13, 'staff@apexgym.com', 'scrypt:32768:8:1$9Hh4YETIz9u7ZWcV$60e5867e9d6c7d297e791a6f7cd21df6cb723c6b8475444b129ed615ee6ce800b106eea3e23e4f2f197e5d961a17109e3d8e67225e86bd435bf2f5843d3abcaf', 'staff', 'active');

-- 2. TRAINERS
INSERT INTO `trainers` (`id`, `user_id`, `trainer_code`, `full_name`, `email`, `phone`, `specialization`, `experience_years`, `bio`, `schedule`, `photo_url`, `status`) VALUES
(1, 2, 'TRN-001', 'Marcus Vance', 'marcus@apexgym.com', '+1 (555) 234-5678', 'Strength & Conditioning', 8, 'Former Olympic powerlifting coach specializing in compound mechanics, functional hypertrophy, and athletic speed.', 'Mon-Fri: 06:00 - 14:00', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', 'active'),
(2, 3, 'TRN-002', 'Elena Rostova', 'elena@apexgym.com', '+1 (555) 345-6789', 'HIIT, Mobility & Calisthenics', 6, 'Master trainer in high-intensity cardiovascular conditioning, dynamic mobility protocols, and gymnastic calisthenics.', 'Mon-Sat: 08:00 - 16:00', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80', 'active'),
(3, 4, 'TRN-003', 'David Chen', 'david@apexgym.com', '+1 (555) 456-7890', 'Bodybuilding & Sports Nutrition', 10, 'Certified sports nutritionist and IFBB pro coach focusing on aesthetic symmetry, progressive overload, and micronutrient balance.', 'Tue-Sat: 12:00 - 20:00', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', 'active');

-- 3. MEMBERSHIP PLANS
INSERT INTO `membership_plans` (`id`, `name`, `code`, `duration_months`, `price`, `description`, `features`, `badge`, `is_active`) VALUES
(1, 'Silver Starter', 'PLAN-SILVER', 1, 49.00, 'Essential access to gym floor and standard cardio zone.', '["Full Gym Floor Access", "Locker Room & Showers", "Free Water Station", "Standard Support"]', NULL, 1),
(2, 'Gold Performance', 'PLAN-GOLD', 3, 129.00, 'Ideal for dedicated athletes aiming for structured results.', '["Full Gym Floor & Olympic Arena", "Sauna & Steam Bath", "1 Monthly Trainer Session", "Complimentary Towel Service", "Apex Mobile App Access"]', 'Popular', 1),
(3, 'Platinum Elite', 'PLAN-PLATINUM', 6, 229.00, 'Comprehensive high-performance package with recovery suite.', '["24/7 VIP Access", "Unlimited Sauna & Cryo Recovery", "4 Dedicated Trainer Sessions", "Customized Nutrition Blueprint", "Locker Reservation", "Guest Pass (2/month)"]', 'Best Value', 1),
(4, 'Apex Black VIP', 'PLAN-BLACK', 12, 399.00, 'Ultimate luxury fitness lifestyle with private personal coaching.', '["All-Inclusive 24/7 Access", "Weekly 1-on-1 Personal Coaching", "Unlimited Recovery & Spa Suite", "Full Biometric & Body Composition Scans", "VIP Private Lounge Access", "Custom Apparel Kit"]', 'VIP Access', 1);

-- 4. MEMBERS
INSERT INTO `members` (`id`, `user_id`, `member_code`, `full_name`, `email`, `phone`, `gender`, `date_of_birth`, `emergency_contact`, `address`, `photo_url`, `joining_date`, `status`) VALUES
(1, 5, 'APX-1001', 'Alex Rivera', 'alex@apexgym.com', '+1 (555) 901-1122', 'male', '1995-04-12', 'Maria Rivera (+1 555-901-9988)', '742 Evergreen Terrace, Seattle, WA', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', '2026-01-15', 'active'),
(2, 6, 'APX-1002', 'Sarah Connor', 'sarah@apexgym.com', '+1 (555) 902-2233', 'female', '1992-08-23', 'John Connor (+1 555-902-8877)', '1204 Cyber Way, Los Angeles, CA', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', '2026-06-20', 'active'),
(3, 7, 'APX-1003', 'Jordan Miller', 'jordan@apexgym.com', '+1 (555) 903-3344', 'male', '1998-11-05', 'Rachel Miller (+1 555-903-7766)', '89 Pinecrest Road, Austin, TX', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80', '2026-08-10', 'expired'),
(4, 8, 'APX-1004', 'Samantha Hayes', 'samantha@apexgym.com', '+1 (555) 904-4455', 'female', '1990-02-18', 'Keith Hayes (+1 555-904-6655)', '310 Ocean Boulevard, Miami, FL', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', '2026-03-01', 'active'),
(5, 9, 'APX-1005', 'Liam Gallagher', 'liam@apexgym.com', '+1 (555) 905-5566', 'male', '1993-07-30', 'Noel Gallagher (+1 555-905-5544)', '504 Manchester Ave, Chicago, IL', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', '2026-05-14', 'active'),
(6, 10, 'APX-1006', 'Maya Patel', 'maya@apexgym.com', '+1 (555) 906-6677', 'female', '1997-12-14', 'Anil Patel (+1 555-906-4433)', '21 Silicon Vista, San Jose, CA', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', '2026-07-01', 'active'),
(7, 11, 'APX-1007', 'Carlos Santana', 'carlos@apexgym.com', '+1 (555) 907-7788', 'male', '1989-09-09', 'Elena Santana (+1 555-907-3322)', '108 Sunset Strip, San Diego, CA', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80', '2026-02-10', 'active'),
(8, 12, 'APX-1008', 'Emily Watson', 'emily@apexgym.com', '+1 (555) 908-8899', 'female', '2000-05-20', 'George Watson (+1 555-908-2211)', '77 Beacon Hill, Boston, MA', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80', '2026-09-15', 'pending');

-- 5. MEMBERSHIPS
-- Current date context: September 2026
INSERT INTO `memberships` (`id`, `member_id`, `plan_id`, `start_date`, `end_date`, `price_paid`, `status`, `auto_renew`) VALUES
(1, 1, 3, '2026-04-15', '2026-10-15', 229.00, 'active', 1),      -- Alex: Active Platinum (Expires Oct 15)
(2, 2, 2, '2026-06-21', '2026-09-21', 129.00, 'active', 0),     -- Sarah: Gold (Expires in 3 days! Expiring soon)
(3, 3, 1, '2026-08-10', '2026-09-10', 49.00, 'expired', 0),     -- Jordan: Silver (Expired on Sep 10)
(4, 4, 4, '2026-03-01', '2027-03-01', 399.00, 'active', 1),      -- Samantha: Apex Black (Expires next year)
(5, 5, 2, '2026-07-01', '2026-10-01', 129.00, 'active', 1),      -- Liam: Gold (Expires Oct 1)
(6, 6, 1, '2026-09-01', '2026-10-01', 49.00, 'active', 0),      -- Maya: Silver (Expires Oct 1)
(7, 7, 3, '2026-08-15', '2027-02-15', 229.00, 'active', 1),      -- Carlos: Platinum (Expires Feb 2027)
(8, 8, 2, '2026-09-18', '2026-12-18', 129.00, 'active', 0);     -- Emily: Gold (Started today)

-- 6. TRAINER ASSIGNMENTS
INSERT INTO `trainer_assignments` (`id`, `member_id`, `trainer_id`, `assigned_date`, `status`, `notes`) VALUES
(1, 1, 1, '2026-04-15', 'active', 'Focusing on upper-body hypertrophy and heavy deadlift technique.'),
(2, 2, 2, '2026-06-22', 'active', 'Mobility conditioning and explosive athletic speed.'),
(3, 4, 3, '2026-03-05', 'active', 'Competition prep, body fat reduction to sub-12%, strict nutrient timing.'),
(4, 5, 1, '2026-07-05', 'active', 'Powerbuilding split: squat and bench press progression.');

-- 7. ATTENDANCE (Past two weeks + today)
INSERT INTO `attendance` (`member_id`, `date`, `check_in_time`, `check_out_time`, `status`, `notes`) VALUES
-- Today (2026-09-18)
(1, '2026-09-18', '07:15:00', '08:45:00', 'present', 'Chest & Triceps session complete'),
(2, '2026-09-18', '08:30:00', '09:40:00', 'present', 'HIIT Mobility circuit'),
(4, '2026-09-18', '06:45:00', '08:15:00', 'present', 'Early morning heavy back day'),
(5, '2026-09-18', '09:00:00', NULL, 'present', 'Currently in cardio theater'),
(7, '2026-09-18', '11:15:00', NULL, 'present', 'Leg day with trainer Marcus'),

-- Yesterday (2026-09-17)
(1, '2026-09-17', '07:20:00', '08:50:00', 'present', 'Back & Biceps'),
(2, '2026-09-17', '08:15:00', '09:30:00', 'present', 'Recovery sauna & stretch'),
(4, '2026-09-17', '07:00:00', '08:30:00', 'present', 'Shoulders & Calves'),
(6, '2026-09-17', '17:30:00', '18:45:00', 'present', 'Evening treadmill & core'),

-- 2026-09-16
(1, '2026-09-16', '07:10:00', '08:40:00', 'present', 'Leg day'),
(5, '2026-09-16', '08:45:00', '10:00:00', 'present', 'Bench press volume'),
(7, '2026-09-16', '12:00:00', '13:15:00', 'present', 'Full body workout'),

-- 2026-09-15
(1, '2026-09-15', '07:30:00', '09:00:00', 'present', 'Shoulders & Arms'),
(2, '2026-09-15', '08:00:00', '09:15:00', 'present', 'Conditioning'),
(4, '2026-09-15', '06:30:00', '08:00:00', 'present', 'Squats & Quads');

-- 7b. TRAINER ATTENDANCE SEEDS
INSERT INTO `trainer_attendance` (`trainer_id`, `date`, `in_time`, `out_time`, `total_hours`, `status`, `notes`) VALUES
(1, CURDATE(), '06:00:00', NULL, NULL, 'present', 'Morning Olympic lifting shift - Active'),
(2, CURDATE(), '08:00:00', '16:00:00', 8.00, 'completed', 'HIIT & Mobility shift - Completed');

-- 8. PAYMENTS
INSERT INTO `payments` (`id`, `member_id`, `membership_id`, `invoice_no`, `amount`, `payment_date`, `payment_method`, `transaction_id`, `status`, `notes`) VALUES
(1, 1, 1, 'INV-202604-1001', 229.00, '2026-04-15', 'card', 'TXN_APX_948123', 'paid', 'Platinum Elite 6-Month Plan'),
(2, 2, 2, 'INV-202606-1002', 129.00, '2026-06-21', 'upi', 'TXN_APX_837192', 'paid', 'Gold Performance 3-Month Plan'),
(3, 3, 3, 'INV-202608-1003', 49.00, '2026-08-10', 'cash', 'TXN_APX_726351', 'paid', 'Silver Starter 1-Month Plan'),
(4, 4, 4, 'INV-202603-1004', 399.00, '2026-03-01', 'bank_transfer', 'TXN_APX_615243', 'paid', 'Apex Black VIP Annual Pass'),
(5, 5, 5, 'INV-202607-1005', 129.00, '2026-07-01', 'card', 'TXN_APX_504938', 'paid', 'Gold Performance Renewal'),
(6, 6, 6, 'INV-202609-1006', 49.00, '2026-09-01', 'card', 'TXN_APX_493821', 'paid', 'Silver Starter Monthly'),
(7, 7, 7, 'INV-202608-1007', 229.00, '2026-08-15', 'card', 'TXN_APX_382710', 'paid', 'Platinum Elite Plan'),
(8, 8, 8, 'INV-202609-1008', 129.00, '2026-09-18', 'upi', 'TXN_APX_271609', 'paid', 'New Registration - Gold Performance');

-- 9. WORKOUT PLANS
INSERT INTO `workout_plans` (`id`, `name`, `goal`, `difficulty`, `duration_weeks`, `description`, `created_by_trainer_id`) VALUES
(1, 'Apex Hypertrophy 5-Day Split', 'Hypertrophy & Muscle Mass', 'Intermediate', 10, 'A high-volume bodybuilding protocol focusing on time-under-tension, progressive overload, and optimal muscle protein synthesis.', 1),
(2, 'Dynamic Athletic HIIT & Core', 'Fat Loss & Conditioning', 'Intermediate', 8, 'Metabolic conditioning combining kettlebell complexes, plyometrics, and functional core stabilization.', 2),
(3, 'Foundational Power & Mass', 'Raw Strength & Density', 'Advanced', 12, 'Heavy compound barbell focus building maximal strength on squat, bench, deadlift, and overhead press.', 3);

-- 10. WORKOUT EXERCISES
INSERT INTO `workout_exercises` (`plan_id`, `day_of_week`, `exercise_name`, `muscle_group`, `sets`, `reps`, `rest_seconds`, `notes`, `order_seq`) VALUES
-- Plan 1: Monday - Chest & Triceps
(1, 'Monday', 'Incline Barbell Bench Press', 'Chest', 4, '8-10', 90, 'Focus on 2-second eccentric phase', 1),
(1, 'Monday', 'Flat Dumbbell Press', 'Chest', 4, '10-12', 75, 'Deep stretch at the bottom', 2),
(1, 'Monday', 'Cable Chest Flyes', 'Chest', 3, '12-15', 60, 'Squeeze at peak contraction', 3),
(1, 'Monday', 'Dips (Weighted if possible)', 'Chest/Triceps', 3, '10-12', 60, 'Forward torso lean', 4),
(1, 'Monday', 'Triceps Rope Pushdown', 'Triceps', 4, '12-15', 45, 'Spread ropes at the bottom', 5),

-- Plan 1: Tuesday - Back & Biceps
(1, 'Tuesday', 'Conventional Deadlift', 'Back', 4, '5-6', 120, 'Keep neutral spine throughout', 1),
(1, 'Tuesday', 'Lat Pulldown (Wide Grip)', 'Back', 4, '10-12', 75, 'Pull elbows towards back pockets', 2),
(1, 'Tuesday', 'Chest-Supported T-Bar Row', 'Back', 4, '8-10', 90, 'Retract scapulae fully', 3),
(1, 'Tuesday', 'Incline Dumbbell Bicep Curls', 'Biceps', 4, '10-12', 60, 'Maintain strict elbow position', 4),
(1, 'Tuesday', 'Hammer Curls', 'Forearms/Biceps', 3, '12-15', 45, 'Explosive up, controlled down', 5),

-- Plan 1: Wednesday - Rest & Active Recovery
(1, 'Wednesday', 'Light Incline Walk & Foam Rolling', 'Full Body', 1, '30 min', 0, 'Keep heart rate below 120 bpm', 1),

-- Plan 1: Thursday - Legs & Calves
(1, 'Thursday', 'Barbell Back Squats', 'Quadriceps', 4, '6-8', 120, 'Hit full parallel or below', 1),
(1, 'Thursday', 'Romanian Deadlifts', 'Hamstrings', 4, '8-10', 90, 'Hinge at hips, slight knee bend', 2),
(1, 'Thursday', 'Leg Press (45 Degree)', 'Quadriceps', 3, '12-15', 75, 'Continuous tension', 3),
(1, 'Thursday', 'Standing Calf Raises', 'Calves', 4, '15-20', 45, 'Hold peak stretch for 2 seconds', 4),

-- Plan 1: Friday - Shoulders & Abs
(1, 'Friday', 'Seated Dumbbell Overhead Press', 'Shoulders', 4, '8-10', 90, 'Brace core, full lockout', 1),
(1, 'Friday', 'Leaning Cable Lateral Raise', 'Lateral Delts', 4, '12-15', 60, 'Strict form, no swinging', 2),
(1, 'Friday', 'Face Pulls with External Rotation', 'Rear Delts', 4, '15-20', 60, 'Pull toward forehead', 3),
(1, 'Friday', 'Hanging Leg Raises', 'Core', 3, '12-15', 45, 'Control the swing', 4);

-- 11. MEMBER WORKOUT ASSIGNMENTS
INSERT INTO `member_workout_assignments` (`member_id`, `plan_id`, `assigned_date`, `status`, `notes`) VALUES
(1, 1, '2026-04-16', 'active', 'Progressing weight every 2 weeks. Deload scheduled for week 6.'),
(2, 2, '2026-06-22', 'active', 'High tempo focus to boost VO2 max.'),
(4, 3, '2026-03-06', 'active', 'Aiming for 405lb deadlift and 315lb squat before year end.');

-- 12. DIET PLANS
INSERT INTO `diet_plans` (`id`, `name`, `goal`, `calorie_target`, `protein_g`, `carbs_g`, `fats_g`, `description`, `created_by_trainer_id`) VALUES
(1, 'High Protein Lean Bulk', 'Clean Muscle Gain', 2850, 210, 320, 75, 'Optimized nutrient timing for maximal muscle hypertrophy with minimal adipose accumulation.', 1),
(2, 'Athletic Shred & Conditioning', 'Fat Loss & Preservation', 2150, 195, 180, 60, 'Calorie-deficit protocol designed to shred body fat while preserving lean contractile mass.', 2),
(3, 'VIP Performance Fuel', 'Endurance & Cognitive Vitality', 2500, 175, 260, 70, 'Nutrient-dense clean eating blueprint with anti-inflammatory foods and antioxidant rich fruits.', 3);

-- 13. DIET MEALS
INSERT INTO `diet_meals` (`plan_id`, `meal_type`, `meal_name`, `calories`, `protein_g`, `carbs_g`, `fats_g`, `timing`, `instructions`, `order_seq`) VALUES
-- Plan 1
(1, 'Breakfast', 'Power Oats & Egg White Scramble', 650, 48, 75, 16, '07:30 AM', '100g rolled oats with blueberries, 5 egg whites + 2 whole eggs, 1 tbsp almond butter', 1),
(1, 'Mid-Morning Snack', 'Greek Yogurt & Almond Bowl', 350, 28, 25, 14, '10:30 AM', '200g non-fat Greek yogurt, 20g organic almonds, raw honey drizzle', 2),
(1, 'Lunch', 'Grilled Salmon, Quinoa & Asparagus', 750, 52, 65, 24, '01:30 PM', '200g wild caught salmon fillet, 150g cooked quinoa, steamed garlic asparagus', 3),
(1, 'Evening Snack', 'Apex Whey Isolate & Banana', 320, 32, 38, 3, '04:45 PM', '1 scoop Whey isolate in cold water, 1 medium ripe banana', 4),
(1, 'Dinner', 'Lean Sirloin Steak & Sweet Potato', 780, 50, 67, 18, '08:00 PM', '180g grass-fed lean sirloin, 250g baked sweet potato, large green garden salad', 5);

-- 14. MEMBER DIET ASSIGNMENTS
INSERT INTO `member_diet_assignments` (`member_id`, `plan_id`, `assigned_date`, `status`, `notes`) VALUES
(1, 1, '2026-04-16', 'active', 'Hydration target: 3.5 liters per day minimum.'),
(2, 2, '2026-06-22', 'active', 'Strict carb cutoff after 8:00 PM on non-training days.');

-- 15. NOTIFICATIONS
INSERT INTO `notifications` (`user_id`, `title`, `message`, `type`, `is_read`, `created_at`) VALUES
-- Admin Notifications (user_id = 1)
(1, 'Membership Expiring Soon', 'Member Sarah Connor (APX-1002) Gold Performance membership expires in 3 days.', 'warning', 0, '2026-09-18 08:00:00'),
(1, 'New Member Onboarded', 'Emily Watson registered for Gold Performance membership.', 'success', 0, '2026-09-18 09:30:00'),
(1, 'Membership Expired', 'Jordan Miller (APX-1003) membership has expired.', 'reminder', 1, '2026-09-11 00:00:00'),

-- Alex Rivera Notifications (user_id = 5)
(5, 'Workout Plan Active', 'Your trainer Marcus Vance updated your 5-Day Hypertrophy Routine.', 'info', 0, '2026-09-16 10:00:00'),
(5, 'Payment Receipt Available', 'Invoice INV-202604-1001 for $229.00 has been verified.', 'success', 1, '2026-04-15 12:00:00'),
(5, 'Check-in Verified', 'Check-in recorded at 07:15 AM today. Great job showing up!', 'info', 0, '2026-09-18 07:15:00'),

-- Sarah Connor Notifications (user_id = 6)
(6, 'Membership Renewal Alert', 'Your Gold Performance membership expires on September 21, 2026. Renew today to keep your streak!', 'warning', 0, '2026-09-18 06:00:00');



-- 16. ROLE PERMISSIONS
INSERT INTO role_permissions (role, permission_key, is_granted) VALUES
('admin', 'members:view', 1),
('staff', 'members:view', 1),
('trainer', 'members:view', 1),
('member', 'members:view', 0),
('admin', 'members:create', 1),
('staff', 'members:create', 1),
('trainer', 'members:create', 0),
('member', 'members:create', 0),
('admin', 'members:edit', 1),
('staff', 'members:edit', 1),
('trainer', 'members:edit', 0),
('member', 'members:edit', 0),
('admin', 'members:delete', 1),
('staff', 'members:delete', 0),
('trainer', 'members:delete', 0),
('member', 'members:delete', 0),
('admin', 'attendance:view', 1),
('staff', 'attendance:view', 1),
('trainer', 'attendance:view', 1),
('member', 'attendance:view', 0),
('admin', 'attendance:checkin', 1),
('staff', 'attendance:checkin', 1),
('trainer', 'attendance:checkin', 1),
('member', 'attendance:checkin', 0),
('admin', 'attendance:checkout', 1),
('staff', 'attendance:checkout', 1),
('trainer', 'attendance:checkout', 1),
('member', 'attendance:checkout', 0),
('admin', 'attendance:edit', 1),
('staff', 'attendance:edit', 1),
('trainer', 'attendance:edit', 0),
('member', 'attendance:edit', 0),
('admin', 'badges:view', 1),
('staff', 'badges:view', 1),
('trainer', 'badges:view', 1),
('member', 'badges:view', 0),
('admin', 'trainers:view', 1),
('staff', 'trainers:view', 1),
('trainer', 'trainers:view', 1),
('member', 'trainers:view', 0),
('admin', 'trainers:manage', 1),
('staff', 'trainers:manage', 0),
('trainer', 'trainers:manage', 0),
('member', 'trainers:manage', 0),
('admin', 'trainer_attendance:manage', 1),
('staff', 'trainer_attendance:manage', 1),
('trainer', 'trainer_attendance:manage', 1),
('member', 'trainer_attendance:manage', 0),
('admin', 'plans:view', 1),
('staff', 'plans:view', 1),
('trainer', 'plans:view', 1),
('member', 'plans:view', 0),
('admin', 'plans:manage', 1),
('staff', 'plans:manage', 0),
('trainer', 'plans:manage', 0),
('member', 'plans:manage', 0),
('admin', 'payments:view', 1),
('staff', 'payments:view', 1),
('trainer', 'payments:view', 0),
('member', 'payments:view', 0),
('admin', 'payments:create', 1),
('staff', 'payments:create', 1),
('trainer', 'payments:create', 0),
('member', 'payments:create', 0),
('admin', 'workouts:view', 1),
('staff', 'workouts:view', 1),
('trainer', 'workouts:view', 1),
('member', 'workouts:view', 0),
('admin', 'workouts:manage', 1),
('staff', 'workouts:manage', 0),
('trainer', 'workouts:manage', 1),
('member', 'workouts:manage', 0),
('admin', 'diets:view', 1),
('staff', 'diets:view', 1),
('trainer', 'diets:view', 1),
('member', 'diets:view', 0),
('admin', 'diets:manage', 1),
('staff', 'diets:manage', 0),
('trainer', 'diets:manage', 1),
('member', 'diets:manage', 0),
('admin', 'reports:view', 1),
('staff', 'reports:view', 0),
('trainer', 'reports:view', 0),
('member', 'reports:view', 0),
('admin', 'reports:export', 1),
('staff', 'reports:export', 0),
('trainer', 'reports:export', 0),
('member', 'reports:export', 0),
('admin', 'roles:manage', 1),
('staff', 'roles:manage', 0),
('trainer', 'roles:manage', 0),
('member', 'roles:manage', 0);

PRAGMA foreign_keys = ON;
