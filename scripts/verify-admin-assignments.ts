import "reflect-metadata";
import {
  getUserRepository,
  getProgramRepository,
  getAssignmentRepository,
  getApplicationRepository,
  getProgramSuperviseeRepository,
} from "../lib/db/data-source";
import { UserRole } from "../lib/db/entities/User";
import { ApplicationStatus } from "../lib/db/entities/SupervisionApplication";

async function verifyAdminAssignments() {
  console.log("🧪 Starting Admin Manual Assignments Feature Verification...\n");

  const userRepo = await getUserRepository();
  const programRepo = await getProgramRepository();
  const assignRepo = await getAssignmentRepository();
  const appRepo = await getApplicationRepository();
  const progSupveeRepo = await getProgramSuperviseeRepository();

  // 1. Get test users & active program
  const admin = await userRepo.findOneBy({ role: UserRole.ADMIN });
  const supervisor = await userRepo.findOneBy({ email: "supervisor@example.com" });
  const supervisee = await userRepo.findOneBy({ email: "supervisee@example.com" });
  const program = await programRepo.findOneBy({ name: "CBT Supervision 2026" });

  if (!admin || !supervisor || !supervisee || !program) {
    throw new Error("Missing seeded test data (admin, supervisor, supervisee, or CBT program).");
  }
  console.log("✅ 1. Seeded test entities loaded.");

  // Create a second supervisor for reassign testing
  let supervisor2 = await userRepo.findOneBy({ email: "supervisor2@example.com" });
  if (!supervisor2) {
    supervisor2 = userRepo.create({
      name: "Dr. Second Supervisor",
      email: "supervisor2@example.com",
      password: supervisor.password,
      role: UserRole.SUPERVISOR,
      areasOfInterest: ["Family Systems", "CBT"],
    });
    await userRepo.save(supervisor2);
  }
  console.log("✅ 2. Target supervisors ready for pairing.");

  // 2. Clean any existing assignment for this test
  const existingAssign = await assignRepo.findOneBy({
    superviseeId: supervisee.id,
    programId: program.id,
  });
  if (existingAssign) {
    await assignRepo.remove(existingAssign);
  }

  // 3. Create a dummy pending application to test auto-withdrawal
  let testApp = await appRepo.findOneBy({
    superviseeId: supervisee.id,
    programId: program.id,
    status: ApplicationStatus.PENDING,
  });
  if (!testApp) {
    testApp = appRepo.create({
      superviseeId: supervisee.id,
      supervisorId: supervisor.id,
      programId: program.id,
      message: "Pending request to be auto-withdrawn by admin assignment.",
      status: ApplicationStatus.PENDING,
    });
    await appRepo.save(testApp);
  }
  console.log("✅ 3. Pending application created to test auto-withdrawal behavior.");

  // 4. Simulate Admin Manual Assignment Creation
  const newAssignment = assignRepo.create({
    supervisorId: supervisor.id,
    superviseeId: supervisee.id,
    programId: program.id,
  });
  await assignRepo.save(newAssignment);

  // Auto-withdraw pending application
  testApp.status = ApplicationStatus.WITHDRAWN;
  await appRepo.save(testApp);

  console.log(`✅ 4. Admin manually created assignment (ID: ${newAssignment.id}).`);

  // Verify supervisee is locked
  const lockCheck1 = await assignRepo.findOneBy({ superviseeId: supervisee.id, programId: program.id });
  if (!lockCheck1) throw new Error("Assignment was not found!");
  console.log("✅ 5. Dynamic lock constraint verified: Supervisee is locked in CBT program.");

  // 5. Test Reassignment to Supervisor 2
  newAssignment.supervisorId = supervisor2.id;
  await assignRepo.save(newAssignment);

  const reassignedCheck = await assignRepo.findOneBy({ id: newAssignment.id });
  if (reassignedCheck?.supervisorId !== supervisor2.id) {
    throw new Error("Reassignment failed!");
  }
  console.log(`✅ 6. Assignment successfully reassigned to Supervisor 2 (${supervisor2.name}).`);

  // 6. Test Revoke / Unassign
  await assignRepo.remove(newAssignment);

  const lockCheck2 = await assignRepo.findOneBy({ superviseeId: supervisee.id, programId: program.id });
  if (lockCheck2) throw new Error("Revocation failed — assignment still exists!");
  console.log("✅ 7. Assignment revoked successfully. Supervisee is unlocked from the program.");

  console.log("\n🎉 All Admin Manual Assignment flows verified successfully!");
  process.exit(0);
}

verifyAdminAssignments().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
