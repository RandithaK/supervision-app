import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import type { User } from "./User";

export enum ProgramStatus {
  DRAFT = "DRAFT",       // Visible to supervisors only, not supervisees
  ACTIVE = "ACTIVE",     // Fully visible and operational
  ARCHIVED = "ARCHIVED", // Read-only, no new joins or applications
}

@Entity({ name: "programs" })
export class Program {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({
    type: "simple-enum",
    enum: ProgramStatus,
    default: ProgramStatus.ACTIVE,
  })
  status!: ProgramStatus;

  @Column({ type: "varchar" })
  createdById!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "createdById" })
  createdBy!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
