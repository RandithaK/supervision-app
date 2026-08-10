import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  SUPERADMIN = "SUPERADMIN",
  ADMIN = "ADMIN",
  SUPERVISOR = "SUPERVISOR",
  SUPERVISEE = "SUPERVISEE",
}

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar" })
  password!: string;

  @Column({
    type: "simple-enum",
    enum: UserRole,
    default: UserRole.SUPERVISEE,
  })
  role!: UserRole;

  @Column({ type: "simple-array", nullable: true })
  areasOfInterest?: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
