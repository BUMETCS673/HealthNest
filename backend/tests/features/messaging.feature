Feature: Secure Patient-Provider Messaging
  As a patient
  I want to send and receive messages with my care team
  So that I can communicate securely about my health

  Background:
    Given I am authenticated as a patient

  Scenario: Patient sends a message successfully
    When I send a message with body 'Hello'
    Then the response status should be 201
    And the message should contain my sender ID

  Scenario: Patient views their inbox
    Given a message has been sent to me
    When I request my inbox
    Then the response status should be 200
    And I should see at least 1 message in the response

  Scenario: Unauthenticated user cannot send a message
    Given I am not authenticated
    When I send a message with body 'Hello'
    Then the response status should be 401