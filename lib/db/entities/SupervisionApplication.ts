import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

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

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "superviseeId" })
  supervisee!: User;

  @Column({ type: "varchar" })
  supervisorId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supervisorId" })
  supervisor!: User;

  @Column({ type: "text", nullable: true })
  message?: string | null;

  @Column({
    type: "simple-enum",
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status!: ApplicationStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
