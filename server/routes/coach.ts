import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { generateCoachResponse } from "../services/coachingService";
import type { User } from "@shared/schema";
import { z } from "zod";

const messageSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
});

export function registerCoachRoutes(app: Express) {
  app.get("/api/coach/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);
      res.json(conversations);
    } catch (error) {
      console.error("Get coach conversations error:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/coach/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversation = await storage.getCoachConversation(req.params.id);
      if (!conversation || conversation.userId !== user.id) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getCoachMessages(conversation.id);
      res.json({ conversation, messages });
    } catch (error) {
      console.error("Get coach conversation error:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/coach/message", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const parsed = messageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid message", details: parsed.error.errors });
      }

      const { message, conversationId } = parsed.data;
      let conversation;

      if (conversationId) {
        conversation = await storage.getCoachConversation(conversationId);
        if (!conversation || conversation.userId !== user.id) {
          return res.status(404).json({ error: "Conversation not found" });
        }
      } else {
        conversation = await storage.createCoachConversation({
          userId: user.id,
          title: message.substring(0, 100),
          status: "active",
        });
      }

      await storage.createCoachMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
      });

      const existingMessages = await storage.getCoachMessages(conversation.id);
      const history = existingMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const coachResponse = await generateCoachResponse(
        message,
        history,
        conversation.financialProfile,
      );

      const assistantMsg = await storage.createCoachMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: coachResponse.message,
        structuredData: coachResponse.profile || coachResponse.actionPlan || coachResponse.documentChecklist
          ? {
              profile: coachResponse.profile || null,
              actionPlan: coachResponse.actionPlan || null,
              documentChecklist: coachResponse.documentChecklist || null,
            }
          : null,
      });

      if (coachResponse.profile || coachResponse.actionPlan || coachResponse.documentChecklist) {
        const updateData: Record<string, any> = {};
        if (coachResponse.profile) {
          updateData.financialProfile = coachResponse.profile;
          updateData.readinessTier = coachResponse.profile.readinessTier;
          updateData.readinessScore = coachResponse.profile.readinessScore;
          updateData.recommendedLoanTypes = coachResponse.profile.recommendedLoanTypes;
        }
        if (coachResponse.actionPlan) {
          updateData.actionPlan = coachResponse.actionPlan;
        }
        if (coachResponse.documentChecklist) {
          updateData.documentChecklist = coachResponse.documentChecklist;
        }
        await storage.updateCoachConversation(conversation.id, updateData);
      }

      res.json({
        conversationId: conversation.id,
        message: assistantMsg,
        profile: coachResponse.profile || conversation.financialProfile || null,
        actionPlan: coachResponse.actionPlan || conversation.actionPlan || null,
        documentChecklist: coachResponse.documentChecklist || conversation.documentChecklist || null,
      });
    } catch (error) {
      console.error("Coach message error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  app.get("/api/coach/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const conversations = await storage.getCoachConversationsByUser(user.id);
      const activeConv = conversations.find(c => c.financialProfile);
      if (!activeConv) {
        return res.json({ profile: null, actionPlan: null, documentChecklist: null });
      }
      res.json({
        profile: activeConv.financialProfile,
        actionPlan: activeConv.actionPlan,
        documentChecklist: activeConv.documentChecklist,
        readinessTier: activeConv.readinessTier,
        readinessScore: activeConv.readinessScore,
        conversationId: activeConv.id,
      });
    } catch (error) {
      console.error("Get coach profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
}
