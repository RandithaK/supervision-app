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
    },
    {
      name: "Morgan Admin",
      email: "admin@example.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
    {
      name: "Dr. Sam Supervisor",
      email: "supervisor@example.com",
      password: hashedPassword,
      role: UserRole.SUPERVISOR,
    },
    {
      name: "Taylor Supervisee",
      email: "supervisee@example.com",
      password: hashedPassword,
      role: UserRole.SUPERVISEE,
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
      await userRepository.save(existing);
    }

    results.push({
      id: existing.id,
      name: existing.name,
      email: existing.email,
      role: existing.role,
      passwordPlain: defaultPassword,
    });
  }

  return {
    success: true,
    message: "Database seeded successfully with users for all 4 roles.",
    users: results,
  };
}

async function main() {
  console.log("🌱 Seeding SQLite database with default user roles...");
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
      }))
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
