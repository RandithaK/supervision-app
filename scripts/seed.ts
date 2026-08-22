import "reflect-metadata";
import bcrypt from "bcryptjs";
import {
  getUserRepository,
  getProgramRepository,
  getProgramSupervisorRepository,
  getProgramSuperviseeRepository,
} from "../lib/db/data-source";
import { UserRole, type User } from "../lib/db/entities/User";
import { ProgramStatus } from "../lib/db/entities/Program";
import { ProgramParticipantStatus } from "../lib/db/entities/ProgramSupervisor";
import type { Repository } from "typeorm";

export interface SeededUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordPlain: string;
  areasOfInterest?: string[] | null;
}

interface SampleProgramDef {
  name: string;
  description: string;
  status: ProgramStatus;
}

const SAMPLE_PROGRAMS: SampleProgramDef[] = [
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

async function seedSingleUser(
  userRepository: Repository<User>,
  sample: { name: string; email: string; password: string; role: UserRole; areasOfInterest: string[] | null },
  defaultPassword: string
): Promise<SeededUserSummary> {
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

  return {
    id: existing.id,
    name: existing.name,
    email: existing.email,
    role: existing.role,
    passwordPlain: defaultPassword,
    areasOfInterest: existing.areasOfInterest,
  };
}

async function seedUsers(): Promise<SeededUserSummary[]> {
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
    const userSummary = await seedSingleUser(userRepository, sample, defaultPassword);
    results.push(userSummary);
  }

  return results;
}

async function enrollSupervisors(programId: string, supervisors: SeededUserSummary[]) {
  const programSupervisorRepo = await getProgramSupervisorRepository();
  for (const sv of supervisors) {
    const existing = await programSupervisorRepo.findOneBy({
      programId,
      supervisorId: sv.id,
    });
    if (!existing) {
      const membership = programSupervisorRepo.create({
        programId,
        supervisorId: sv.id,
        status: ProgramParticipantStatus.ACTIVE,
      });
      await programSupervisorRepo.save(membership);
    }
  }
}

async function enrollSupervisees(programId: string, supervisees: SeededUserSummary[]) {
  const programSuperviseeRepo = await getProgramSuperviseeRepository();
  for (const se of supervisees) {
    const existing = await programSuperviseeRepo.findOneBy({
      programId,
      superviseeId: se.id,
    });
    if (!existing) {
      const membership = programSuperviseeRepo.create({
        programId,
        superviseeId: se.id,
      });
      await programSuperviseeRepo.save(membership);
    }
  }
}

async function seedPrograms(
  adminId: string,
  supervisors: SeededUserSummary[],
  supervisees: SeededUserSummary[]
) {
  const programRepo = await getProgramRepository();
  console.log("\n📋 Seeding Programs...");

  for (const sp of SAMPLE_PROGRAMS) {
    const existingProgram = await programRepo.findOneBy({ name: sp.name });
    if (existingProgram) {
      console.log(`   ⏭️  Program already exists: ${existingProgram.name}`);
      continue;
    }

    const program = programRepo.create({
      ...sp,
      createdById: adminId,
    });
    await programRepo.save(program);
    console.log(`   ✅ Created program: ${program.name} (${program.status})`);

    if (program.status === ProgramStatus.ACTIVE) {
      await enrollSupervisors(program.id, supervisors);
      if (sp.name === "CBT Supervision 2026") {
        await enrollSupervisees(program.id, supervisees);
      }
    }
  }
}

export async function seedDatabase(): Promise<{
  success: boolean;
  message: string;
  users: SeededUserSummary[];
}> {
  const users = await seedUsers();
  const admin = users.find((u) => u.role === UserRole.ADMIN);
  const supervisors = users.filter((u) => u.role === UserRole.SUPERVISOR);
  const supervisees = users.filter((u) => u.role === UserRole.SUPERVISEE);

  if (admin) {
    await seedPrograms(admin.id, supervisors, supervisees);
  }

  return {
    success: true,
    message: "Database seeded successfully with user accounts, supervisor profiles, and sample programs.",
    users,
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
