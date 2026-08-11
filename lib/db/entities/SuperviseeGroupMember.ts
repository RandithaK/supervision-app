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

export enum GroupMemberStatus {
  PENDING = "PENDING",   // Invited but hasn't accepted
  ACTIVE = "ACTIVE",     // Accepted and in the group
}

@Entity({ name: "supervisee_group_members" })
export class SuperviseeGroupMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  groupId!: string;

  @ManyToOne("SuperviseeGroup", { onDelete: "CASCADE" })
  @JoinColumn({ name: "groupId" })
  group!: SuperviseeGroup;

  @Column({ type: "varchar" })
  userId!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({
    type: "simple-enum",
    enum: GroupMemberStatus,
    default: GroupMemberStatus.ACTIVE,
  })
  status!: GroupMemberStatus;

  @CreateDateColumn()
  joinedAt!: Date;
}
