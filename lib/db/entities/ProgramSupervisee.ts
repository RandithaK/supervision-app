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

@Entity({ name: "program_supervisees" })
@Unique(["programId", "superviseeId"])
export class ProgramSupervisee {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  programId!: string;

  @ManyToOne("Program", { onDelete: "CASCADE" })
  @JoinColumn({ name: "programId" })
  program!: Program;

  @Column({ type: "varchar" })
  superviseeId!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "superviseeId" })
  supervisee!: User;

  @CreateDateColumn()
  joinedAt!: Date;
}
