/* eslint-disable jest/expect-expect */

describe('Home', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('navigate to activity view', () => {
    cy.contains('.nav-link', 'Activity').click();
    //cy.log('**division**');
    //cy.contains('.operator', '÷').click();
  });
});
