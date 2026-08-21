import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import type { Program } from "./Program";
import type { User } from "./User";

export enum ProgramParticipantStatus {
  ACTIVE = "ACTIVE",     // Supervisor is available in this program
  DISABLED = "DISABLED", // Supervisor opted out — no new applications, existing assignments continue
}

@Entity({ name: "program_supervisors" })
@Unique(["programId", "supervisorId"])
export class ProgramSupervisor {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  programId!: string;

  @ManyToOne("Program", { onDelete: "CASCADE" })
  @JoinColumn({ name: "programId" })
  program!: Program;

  @Column({ type: "varchar" })
  supervisorId!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "supervisorId" })
  supervisor!: User;

  @Column({
    type: "simple-enum",
    enum: ProgramParticipantStatus,
    default: ProgramParticipantStatus.ACTIVE,
  })
  status!: ProgramParticipantStatus;

  @CreateDateColumn()
  joinedAt!: Date;
}
