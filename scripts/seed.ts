import "reflect-metadata";
import bcrypt from "bcryptjs";
import {
  getUserRepository,
  getProgramRepository,
  getProgramSupervisorRepository,
  getProgramSuperviseeRepository,
} from "../lib/db/data-source";
import { UserRole } from "../lib/db/entities/User";
import { ProgramStatus } from "../lib/db/entities/Program";
import { ProgramParticipantStatus } from "../lib/db/entities/ProgramSupervisor";

export interface SeededUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordPlain: string;
  areasOfInterest?: string[] | null;
}

export async function seedDatabase(): Promise<{
  success: boolean;
  message: string;
  users: SeededUserSummary[];
}> {
  const userRepository = await getUserRepository();

  const defaultPassword = "password123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const sampleUsers = [
    {
      name: "Alex SuperAdmin",
      email: "superadmin@example.com",
      password: hashedPassword,
      role: UserRole.SUPERADMIN,
      areasOfInterest: null,
    },
    {
      name: "Morgan Admin",
      email: "admin@example.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
      areasOfInterest: null,
    },
    {
      name: "Dr. Sam Supervisor",
      email: "supervisor@example.com",
      password: hashedPassword,
      role: UserRole.SUPERVISOR,
      areasOfInterest: [
        "Cognitive Behavioral Therapy",
        "Clinical Assessment",
        "Child & Adolescent Psychology",
      ],
    },
    {
      name: "Dr. Jamie Carter",
      email: "supervisor2@example.com",
      password: hashedPassword,
      role: UserRole.SUPERVISOR,
      areasOfInterest: [
        "Family Therapy",
        "Trauma-Informed Care",
      ],
    },
    {
      name: "Taylor Supervisee",
      email: "supervisee@example.com",
      password: hashedPassword,
      role: UserRole.SUPERVISEE,
      areasOfInterest: null,
    },
    {
      name: "Jordan Student",
      email: "supervisee2@example.com",
      password: hashedPassword,
      role: UserRole.SUPERVISEE,
      areasOfInterest: null,
    },
  ];

  const results: SeededUserSummary[] = [];

  for (const sample of sampleUsers) {
    let existing = await userRepository.findOneBy({ email: sample.email });

    if (!existing) {
      existing = userRepository.create(sample);
      await userRepository.save(existing);
    } else {
      existing.password = sample.password;
      existing.role = sample.role;
      existing.name = sample.name;
      existing.areasOfInterest = sample.areasOfInterest;
      await userRepository.save(existing);
    }

    results.push({
      id: existing.id,
      name: existing.name,
      email: existing.email,
      role: existing.role,
      passwordPlain: defaultPassword,
      areasOfInterest: existing.areasOfInterest,
    });
  }

  // Seed sample programs
  const programRepo = await getProgramRepository();
  const programSupervisorRepo = await getProgramSupervisorRepository();
  const programSuperviseeRepo = await getProgramSuperviseeRepository();

  const admin = results.find((u) => u.role === UserRole.ADMIN);
  const supervisors = results.filter((u) => u.role === UserRole.SUPERVISOR);
  const supervisees = results.filter((u) => u.role === UserRole.SUPERVISEE);

  const samplePrograms = [
    {
      name: "CBT Supervision 2026",
      description: "Clinical supervision program for Cognitive Behavioral Therapy practitioners.",
      status: ProgramStatus.ACTIVE,
    },
    {
      name: "Family Therapy Practicum",
      description: "Supervised practicum for family therapy trainees.",
      status: ProgramStatus.ACTIVE,
    },
    {
      name: "Upcoming Trauma Workshop",
      description: "Draft program for next semester's trauma-focused supervision.",
      status: ProgramStatus.DRAFT,
    },
  ];

  console.log("\n📋 Seeding Programs...");

  for (const sp of samplePrograms) {
    let program = await programRepo.findOneBy({ name: sp.name });
    if (!program) {
      program = programRepo.create({
        ...sp,
        createdById: admin!.id,
      });
      await programRepo.save(program);
      console.log(`   ✅ Created program: ${program.name} (${program.status})`);

      // Add supervisors to ACTIVE programs
      if (program.status === ProgramStatus.ACTIVE) {
        for (const sv of supervisors) {
          const existing = await programSupervisorRepo.findOneBy({
            programId: program.id,
            supervisorId: sv.id,
          });
          if (!existing) {
            const membership = programSupervisorRepo.create({
              programId: program.id,
              supervisorId: sv.id,
              status: ProgramParticipantStatus.ACTIVE,
            });
            await programSupervisorRepo.save(membership);
          }
        }

        // Add supervisees to first program
        if (sp.name === "CBT Supervision 2026") {
          for (const se of supervisees) {
            const existing = await programSuperviseeRepo.findOneBy({
              programId: program.id,
              superviseeId: se.id,
            });
            if (!existing) {
              const membership = programSuperviseeRepo.create({
                programId: program.id,
                superviseeId: se.id,
              });
              await programSuperviseeRepo.save(membership);
            }
          }
        }
      }
    } else {
      console.log(`   ⏭️  Program already exists: ${program.name}`);
    }
  }

  return {
    success: true,
    message: "Database seeded successfully with user accounts, supervisor profiles, and sample programs.",
    users: results,
  };
}

async function main() {
  console.log("🌱 Seeding SQLite database with default user accounts, areas of interest & programs...");
  try {
    const result = await seedDatabase();
    console.log("✅", result.message);
    console.log("\nSample Accounts Seeded:");
    console.table(
      result.users.map((u) => ({
        Role: u.role,
        Name: u.name,
        Email: u.email,
        Password: u.passwordPlain,
        "Areas of Interest": Array.isArray(u.areasOfInterest)
          ? u.areasOfInterest.join(", ")
          : "N/A",
      }))
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
