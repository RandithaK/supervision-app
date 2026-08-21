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
import { User } from "./User";
import type { Program } from "./Program";

@Entity({ name: "supervision_assignments" })
@Unique(["programId", "superviseeId"])
export class SupervisionAssignment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  supervisorId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supervisorId" })
  supervisor!: User;

  @Column({ type: "varchar" })
  superviseeId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "superviseeId" })
  supervisee!: User;

  @Column({ type: "varchar" })
  programId!: string;

  @ManyToOne("Program", { onDelete: "CASCADE" })
  @JoinColumn({ name: "programId" })
  program!: Program;

  @CreateDateColumn()
  createdAt!: Date;
}

