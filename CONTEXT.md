# Dependency composition and resource ownership

This context describes how applications assemble services and assign
responsibility for their acquired resources.

## Language

**Service**:
A value made available to other parts of an application through dependency
composition. A service is not its provider or its ownership policy.
_Avoid_: Factory when referring to the resulting value

**Provider**:
A declaration of how a service is obtained, including the policies governing
its acquisition and ownership.
_Avoid_: Instance, resource

**Service transformation**:
A change to the service a provider exposes that retains its declared
dependencies, lifetime, metadata, and existing cleanup obligations. The
transformation does not itself establish ownership of the resulting service.
_Avoid_: Mapping when the service-composition purpose should be explicit

**Factory**:
The service-creation callback within a provider. Its declared dependencies are
the services it needs to create its result.
_Avoid_: Provider when referring only to the callback

**Token**:
The identity by which a provided service and its consumers agree on a
dependency.
_Avoid_: Alias when identity rather than an alternative name is intended

**Builder**:
The single immutable declaration of a service graph. A builder builds a bag once
its graph is complete, or seals a module while dependencies are still unmet.
_Avoid_: Module builder, application builder, bag builder

**Module**:
A sealed builder graph with selected exports and requirements that its
installing builder must satisfy. Modules install into builders, including
builders that seal further modules.
_Avoid_: Bag when referring to a reusable declaration; Builder when referring to the sealed value

**Bag**:
A resolvable service composition with its own acquisition and resource-ownership
context.
_Avoid_: Module, registration map

**Acquisition**:
One attempt to obtain a service instance from its provider. Distinct
acquisitions may use the same provider and have distinct cleanup obligations.
_Avoid_: Registration when referring to a created instance

**Acquisition stage**:
A source or transformation result within one acquisition, with its own rule for
when a resource is ready and which value an attached owner receives.
_Avoid_: Factory when referring to a later transformation result

**Registration metadata**:
Descriptive information attached to a provider declaration and available before
its service is acquired. It is shared across acquisitions of that declaration.
_Avoid_: Acquisition metadata for information fixed at declaration time

**Acquisition metadata**:
Descriptive information computed during a particular acquisition. Cached reuse
retains that information, while a new acquisition computes its own metadata.
_Avoid_: Registration metadata for observations about a particular acquisition

**Acquired value**:
The resource accepted for ownership at one acquisition stage. It may differ
from the exposed service when that service represents pending acquisition.
_Avoid_: Resolved service when the distinction from the exposed value matters

**Owned resource**:
A successfully acquired value whose cleanup responsibility was explicitly
accepted by a bag or another application owner.
_Avoid_: Disposable object when merely having a cleanup method is meant

**Borrowed resource**:
A value used without accepting responsibility for its cleanup. Its actual
owner must keep it available for the duration of the borrowing work.
_Avoid_: Unmanaged resource

**Sharing**:
Reusing an existing instance, including the dependencies already bound to it.
Sharing is distinct from recreating the same provider in another context.
_Avoid_: Inheritance when a shared instance is intended

**Presence**:
Whether a value or metadata channel contains an intentionally supplied value.
A present undefined value is distinct from an absent channel.
_Avoid_: Truthiness, non-nullness
