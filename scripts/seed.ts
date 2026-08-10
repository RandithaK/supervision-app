import "reflect-metadata";
import bcrypt from "bcryptjs";
import { getUserRepository } from "../lib/db/data-source";
import { UserRole } from "../lib/db/entities/User";

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
      name: "Taylor Supervisee",
      email: "supervisee@example.com",
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

  return {
    success: true,
    message: "Database seeded successfully with default user accounts and supervisor areas of interest array.",
    users: results,
  };
}

async function main() {
  console.log("🌱 Seeding SQLite database with default user accounts & areas of interest array...");
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
