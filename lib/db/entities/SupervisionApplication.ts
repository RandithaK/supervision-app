import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import type { User } from "./User";
import type { SuperviseeGroup } from "./SuperviseeGroup";
import type { Program } from "./Program";

export enum ApplicationStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
}

@Entity({ name: "supervision_applications" })
export class SupervisionApplication {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  superviseeId!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "superviseeId" })
  supervisee!: User;

  @Column({ type: "varchar" })
  supervisorId!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "supervisorId" })
  supervisor!: User;

  @Column({ type: "varchar", nullable: true })
  programId?: string | null;

  @ManyToOne("Program", { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "programId" })
  program?: Program | null;

  @Column({ type: "text", nullable: true })
  message?: string | null;

  @Column({ type: "varchar", nullable: true })
  groupId?: string | null;

  @ManyToOne("SuperviseeGroup", { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "groupId" })
  group?: SuperviseeGroup | null;

  @Column({
    type: "simple-enum",
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status!: ApplicationStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
