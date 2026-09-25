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
dependencies, lifetime, metadata, and existing disposal obligations. The
transformation does not itself establish ownership of the resulting service.
_Avoid_: Mapping when the service-composition purpose should be explicit

**Factory**:
The service-creation callback within a provider. Its declared dependencies are
the services it needs to create its result.
_Avoid_: Provider when referring only to the callback

**Service dependency graph**:
The relationships between provided services and the services their factories
require. These relationships describe composition, not the sequence of work
performed by acquired services.
_Avoid_: Agent graph, execution graph, workflow graph

**Token**:
The identity by which a provided service and its consumers agree on a
dependency.
_Avoid_: Alias when identity rather than an alternative name is intended

**Single-service token**:
A token that identifies exactly one service.
_Avoid_: Plain token when the kind matters

**Collection token**:
A token that identifies an ordered list of services built from contributions.
Reading it yields the list.
_Avoid_: The `all` reference, contribution channel

**Contribution**:
A provider appended to a collection token's list. Each contribution keeps its
own dependencies, lifetime and disposal.
_Avoid_: Collection member when the provider is meant

**Service key**:
The name or token by which a service is registered, required and resolved.
_Avoid_: Key or name alone, selection

**Builder**:
The single immutable declaration of a service graph. A builder builds a container
once its graph is complete, or seals a module while dependencies are still unmet.
_Avoid_: Module builder, application builder, bag builder, container builder

**Module**:
A sealed builder graph with selected exports and requirements that its
installing builder must satisfy. Modules install into builders, including
builders that seal further modules.
_Avoid_: Container when referring to a reusable declaration; Builder when referring to the sealed value

**Registration**:
A provider stored under a service key in a builder.
_Avoid_: Registration when the provider itself is meant

**Binding**:
A registration's node in a built service dependency graph, public or private to
a module. An acquisition is an attempt against one binding.
_Avoid_: Registration when a node of a built graph is meant

**Container**:
A set of providers together with the instances created from them. Instances are
created on first use, reused inside the container, and released together when it
closes.
_Avoid_: Bag (the name before 0.5, still the product name DI Bag), scope, module, registration map

**Child container**:
A container nested in a parent container for one unit of work, such as a request
or a job. It reuses the tree's singletons, creates its own scoped instances, and
closes before its parent.
_Avoid_: Scope, child scope, request scope

**Container tree**:
A root container and all its child containers. A singleton lives at its root.
_Avoid_: Family, ownership family

**Acquisition**:
One attempt to obtain a service instance from its provider. Distinct
acquisitions may use the same provider and have distinct disposal obligations.
_Avoid_: Registration when referring to a created instance

**Service invocation**:
An operation performed through an acquired service. Repeated invocations of a
shared service are not necessarily new acquisitions.
_Avoid_: Acquisition event when describing every call to a service

**Independent container**:
A container created from another container's providers that shares no instance
with it and is closed separately. It starts a new container tree, and it does not
copy an execution's progress or restore a workflow checkpoint.
_Avoid_: Fork, bag fork, checkpoint fork, workflow replay

**Singleton**:
A lifetime of one instance for a whole container tree.
_Avoid_: Root lifetime, shared lifetime

**Scoped**:
A lifetime of one instance in each container that resolves the service. It is the default.
_Avoid_: Request-scoped when no request is involved

**Transient**:
A lifetime of a new instance for every resolve and every dependency read. The
instance is still released with the container that asked for it.
_Avoid_: Unowned, uncached

**Acquisition stage**:
A source or transformation result within one acquisition, with its own rule for
when a resource is ready and which value an attached owner receives.
_Avoid_: Factory when referring to a later transformation result

**Factory return kind**:
How a factory's return value is treated: inspected for a native Promise, taken as
a synchronous value, taken as a native Promise, or left uninspected.
_Avoid_: Acquisition mode, mode

**Callback receives**:
The choice of what a provider decorator's callback is handed: the service exactly
as exposed, or its fulfilled value.
_Avoid_: Direct, awaited, mode

**Service readiness**:
The state in which listed services exist and their acquisitions have settled. A
caller waits for it before other work continues.
_Avoid_: Startup, start

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
A successfully acquired value whose disposal was explicitly
accepted by a container or another application owner.
_Avoid_: Disposable object when merely having a disposal method is meant

**Borrowed resource**:
A value used without accepting responsibility for its disposal. Its actual
owner must keep it available for the duration of the borrowing work.
_Avoid_: Unmanaged resource

**Disposal**:
Releasing an owned resource when its container closes or its acquisition fails. A
disposer is the callback that does it.
_Avoid_: Cleanup, teardown

**Sharing**:
Reusing an existing instance, including the dependencies already bound to it.
Sharing is distinct from recreating the same provider in another context.
_Avoid_: Inheritance when a shared instance is intended

**Presence**:
Whether a value or metadata channel contains an intentionally supplied value.
A present undefined value is distinct from an absent channel.
_Avoid_: Truthiness, non-nullness
